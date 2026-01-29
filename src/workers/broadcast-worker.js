
'use strict';

const path = require('path');
// This ensures that .env variables are loaded from the project root
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// **DEFINITIVE FIX:** Use worker-specific, runtime-safe JS modules instead of ts-node wrappers.
const { connectToDatabase } = require(path.resolve(process.cwd(), 'src/lib/mongodb.worker.js'));
const { getErrorMessage } = require(path.resolve(process.cwd(), 'src/lib/utils.worker.js'));

const { Kafka } = require('kafkajs');
const undici = require('undici');
const { ObjectId } = require('mongodb');

let pThrottle;
const importPThrottle = async () => {
  if (!pThrottle) {
    pThrottle = (await import('p-throttle')).default;
  }
  return pThrottle;
};

if (!process.env.KAFKA_BROKERS) {
  console.error('[WORKER] FATAL: KAFKA_BROKERS environment variable is not set.');
  process.exit(1);
}

const API_VERSION = 'v22.0';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(',');
const LOG_PREFIX = '[WORKER]';

// -------------------------------------------------------------------
// Logging
// -------------------------------------------------------------------
async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
  try {
    await db.collection('broadcast_logs').insertOne({
      broadcastId,
      projectId,
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error(`${LOG_PREFIX} Failed to write log:`, e);
  }
}

// -------------------------------------------------------------------
// WhatsApp Message Sender
// -------------------------------------------------------------------
async function sendWhatsAppMessage(job, contact, agent) {
  try {
    const { accessToken, phoneNumberId, templateName, language = 'en_US' } = job;

    const payload = {
      messaging_product: 'whatsapp',
      to: contact.phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language }
      }
    };

    const response = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        dispatcher: agent,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
        throwOnError: false
      }
    );

    const json = await response.body.json().catch(() => null);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      const messageId = json?.messages?.[0]?.id || null;
      return { success: true, messageId };
    }

    return {
      success: false,
      error: JSON.stringify(json?.error || json)
    };

  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

// -------------------------------------------------------------------
// MAIN WORKER: PARALLEL eachBatch
// -------------------------------------------------------------------
async function startBroadcastWorker(workerId, kafkaTopic) {
  const { db } = await connectToDatabase();
  const pThrottleLib = await importPThrottle();

  const kafka = new Kafka({
    clientId: `whatsapp-worker-${workerId}`,
    brokers: KAFKA_BROKERS,
  });

  const consumer = kafka.consumer({
    groupId: `sabnode-broadcaster-v5`,
    sessionTimeout: 60000,
    heartbeatInterval: 3000,
  });

  console.log(`${LOG_PREFIX} Worker ${workerId} starting with PARALLEL Kafka batches...`);

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaTopic });

  await consumer.run({
    eachBatch: async ({ batch, heartbeat, resolveOffset, commitOffsetsIfNecessary }) => {

      for (const message of batch.messages) {
        if (!message.value) continue;

        let payload;
        try {
          payload = JSON.parse(message.value.toString());
        } catch {
          console.error(`${LOG_PREFIX} Invalid JSON payload in worker ${workerId}`);
          continue;
        }

        const { jobDetails, contacts } = payload;
        if (!jobDetails?._id || !Array.isArray(contacts)) {
          console.error(`${LOG_PREFIX} Worker ${workerId} | Invalid Kafka payload`);
          continue;
        }

        const broadcastId = new ObjectId(jobDetails._id);
        const projectId = new ObjectId(jobDetails.projectId);

        const mps = Number(jobDetails.messagesPerSecond);
        
        const agent = new undici.Agent({
          connections: 200,
          pipelining: 1,
        });

        await addBroadcastLog(
          db, broadcastId, projectId, "INFO",
          `Worker ${workerId} processing batch: ${contacts.length} contacts | Concurrency: ${mps} msg/s`
        );

        const throttle = pThrottleLib({
          limit: mps,
          interval: 1000,
          strict: true
        });

        const throttledSend = throttle((contact) =>
          sendWhatsAppMessage(jobDetails, contact, agent)
        );

        const results = await Promise.all(
          contacts.map(async (contact) => {
            try { await heartbeat(); } catch (e) { console.warn("Heartbeat failed", e); }
            const r = await throttledSend(contact);
            return { contactId: contact._id, ...r };
          })
        );

        const bulkOps = [];
        let success = 0;
        let failed = 0;

        for (const r of results) {
          if (r.success) {
            success++;
            bulkOps.push({
              updateOne: {
                filter: { _id: new ObjectId(r.contactId) },
                update: {
                  $set: {
                    status: "SENT",
                    sentAt: new Date(),
                    messageId: r.messageId,
                    error: null
                  }
                }
              }
            });
          } else {
            failed++;
            bulkOps.push({
              updateOne: {
                filter: { _id: new ObjectId(r.contactId) },
                update: {
                  $set: {
                    status: "FAILED",
                    error: r.error
                  }
                }
              }
            });
          }
        }

        if (bulkOps.length > 0) {
          await db.collection("broadcast_contacts").bulkWrite(bulkOps, { ordered: false });
        }

        await addBroadcastLog(
          db, broadcastId, projectId, "INFO",
          `Worker ${workerId} finished batch — sent: ${success} | failed: ${failed}`
        );

        await db.collection('broadcasts').updateOne(
          { _id: broadcastId },
          {
            $inc: {
              successCount: success,
              errorCount: failed
            }
          }
        );

        const job = await db.collection('broadcasts').findOne({ _id: broadcastId });

        if ((job.successCount + job.errorCount) >= job.contactCount) {
          await db.collection('broadcasts').updateOne(
            { _id: broadcastId },
            { $set: { status: 'Completed', completedAt: new Date() } }
          );

          await addBroadcastLog(
            db,
            broadcastId,
            projectId,
            "INFO",
            `Worker ${workerId}: Broadcast Completed`
          );
        }

        resolveOffset(message.offset);
      }

      await commitOffsetsIfNecessary();
    }
  });
}

module.exports = { startBroadcastWorker };
