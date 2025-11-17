'use strict';

require('dotenv').config();
const { connectToDatabase } = require('../lib/mongodb.ts');
const { getErrorMessage } = require('../lib/utils.ts');
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

const API_VERSION = 'v23.0';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(',');
const LOG_PREFIX = '[WORKER]';

// ---------------------------------------------------
// LOGGING
// ---------------------------------------------------
async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
  try {
    if (!db || !broadcastId || !projectId) return;
    await db.collection('broadcast_logs').insertOne({
      broadcastId: new ObjectId(String(broadcastId)),
      projectId: new ObjectId(String(projectId)),
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error(`${LOG_PREFIX} Failed to write log:`, e);
  }
}

// ---------------------------------------------------
// SEND WHATSAPP MESSAGE (No rate changes)
// ---------------------------------------------------
async function sendWhatsAppMessage(job, contact, agent) {
  try {
    const { accessToken, phoneNumberId, templateName, language = 'en_US' } = job;

    const body = {
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
        body: JSON.stringify(body),
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
      error: json?.error ? JSON.stringify(json.error) : JSON.stringify(json)
    };

  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

// ---------------------------------------------------
// MAIN WORKER
// ---------------------------------------------------
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

  console.log(`${LOG_PREFIX} Worker ${workerId} starting...`);

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaTopic });

  await consumer.run({
    eachMessage: async ({ message, heartbeat }) => {
      if (!message.value) return;

      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch {
        console.error(`${LOG_PREFIX} Worker ${workerId} | Invalid JSON payload`);
        return;
      }

      const { jobDetails, contacts } = payload;
      if (!jobDetails?._id || !Array.isArray(contacts) || !contacts.length) {
        console.error(`${LOG_PREFIX} Worker ${workerId} | Invalid broadcast payload`);
        return;
      }

      const broadcastId = new ObjectId(jobDetails._id);
      const projectId = new ObjectId(jobDetails.projectId);

      // ---------------------------------------------------
      // USE EXACT mps — no modification
      // ---------------------------------------------------
      const mps = Number(jobDetails.messagesPerSecond) || 80;
console.log(jobDetails.messagesPerSecond);
      // ---------------------------------------------------
      // EXACT rate throttle
      // strict: true ensures NO bursts, EXACT SPEED ONLY
      // ---------------------------------------------------
      const throttle = pThrottleLib({
        limit: mps,
        interval: 1000,
        strict: true
      });

      const agent = new undici.Agent({
        connections: 1000,     // static, not tied to mps
        pipelining: 1,
      });

      await addBroadcastLog(db, broadcastId, projectId, "INFO",
        `Worker ${workerId} started batch: ${contacts.length} contacts | MPS EXACT: ${mps}`);

      const throttledSend = throttle(async (contact) => {
        return sendWhatsAppMessage(jobDetails, contact, agent);
      });

      // ---------------------------------------------------
      // EXACT sending speed loop — no modifications
      // ---------------------------------------------------
      const results = await Promise.all(
        contacts.map(async (contact) => {
          try { heartbeat(); } catch {}

          const res = await throttledSend(contact);

          return {
            contactId: contact._id,
            ...res
          };
        })
      );

      // ---------------------------------------------------
      // Bulk write results
      // ---------------------------------------------------
      const bulk = [];
      let success = 0;
      let failed = 0;

      for (const r of results) {
        if (r.success) {
          success++;
          bulk.push({
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
          bulk.push({
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

      if (bulk.length > 0) {
        await db.collection("broadcast_contacts").bulkWrite(bulk, { ordered: false });
      }

      // Update job counters
      const updated = await db.collection("broadcasts").findOneAndUpdate(
        { _id: broadcastId },
        { $inc: { successCount: success, errorCount: failed } },
        { returnDocument: "after" }
      );

      await addBroadcastLog(db, broadcastId, projectId, "INFO",
        `Worker ${workerId} completed batch — sent: ${success} | failed: ${failed}`);

      // Mark completed
      if (updated.value &&
        (updated.value.successCount + updated.value.errorCount) >= updated.value.contactCount
      ) {
        await db.collection("broadcasts").updateOne(
          { _id: broadcastId },
          { $set: { status: "Completed", completedAt: new Date() } }
        );

        await addBroadcastLog(db, broadcastId, projectId, "INFO",
          `Worker ${workerId}: Broadcast Completed`);
      }

    }
  });

}

module.exports = { startBroadcastWorker };
