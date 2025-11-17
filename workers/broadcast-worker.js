// ./workers/broadcast-worker.js
'use strict';

require('dotenv').config();
const { connectToDatabase } = require('../src/lib/mongodb.js');
const { getErrorMessage } = require('../src/lib/utils.js');
const { Kafka } = require('kafkajs');
const undici = require('undici');
const { ObjectId } = require('mongodb');

if (!process.env.KAFKA_BROKERS) {
  console.error('[WORKER] FATAL: KAFKA_BROKERS environment variable is not set. Worker cannot start.');
  process.exit(1);
}

const API_VERSION = 'v23.0';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(',');

/**
 * Writes a log entry to broadcast_logs (best-effort).
 */
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
    console.error(`[WORKER] Failed to write log for job ${String(broadcastId)}:`, e);
  }
}

/**
 * Send one WhatsApp template message via Meta Graph API (undici).
 * Returns { success: boolean, messageId?: string, error?: string }
 */
async function sendWhatsAppMessage(job, contact) {
  try {
    const {
      accessToken,
      phoneNumberId,
      templateName,
      language,
      components,
      headerImageUrl,
      headerMediaId,
      variableMappings
    } = job;

    const getVars = (text) =>
      text ? [...new Set((text.match(/{{\s*(\d+)\s*}}/g) || []).map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];

    const interpolate = (text, variables) => {
      if (!text) return '';
      return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (m, key) =>
        variables && variables[key] !== undefined ? String(variables[key]) : m
      );
    };

    const payloadComponents = [];
    const headerComponent = components?.find(c => c.type === 'HEADER');
    if (headerComponent) {
      let parameter;
      const format = headerComponent.format?.toLowerCase();
      if (format && (format === 'image' || format === 'video' || format === 'document')) {
        if (headerMediaId) parameter = { type: format, [format]: { id: headerMediaId } };
        else if (headerImageUrl) parameter = { type: format, [format]: { link: headerImageUrl } };
      } else if (format === 'text' && headerComponent.text) {
        if (getVars(headerComponent.text).length > 0) {
          parameter = { type: 'text', text: interpolate(headerComponent.text, contact.variables || {}) };
        }
      }
      if (parameter) payloadComponents.push({ type: 'header', parameters: [parameter] });
    }

    const bodyComponent = components?.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const bodyVars = getVars(bodyComponent.text);
      if (bodyVars.length > 0) {
        const parameters = bodyVars
          .sort((a, b) => a - b)
          .map(varNum => {
            const mapping = variableMappings?.find(m => m.var === String(varNum));
            const varKey = mapping ? mapping.value : `variable${varNum}`;
            const value = contact.variables?.[varKey] || '';
            return { type: 'text', text: value };
          });
        payloadComponents.push({ type: 'body', parameters });
      }
    }

    const messageData = {
      messaging_product: 'whatsapp',
      to: contact.phone,
      recipient_type: 'individual',
      type: 'template',
      template: {
        name: templateName,
        language: { code: language || 'en_US' },
        ...(payloadComponents.length > 0 && { components: payloadComponents })
      }
    };

    const response = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData),
        throwOnError: false,
        bodyTimeout: 20000,
      }
    );

    const responseBody = await response.body.json();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return { success: false, error: `Meta API error ${response.statusCode}: ${JSON.stringify(responseBody?.error || responseBody)}` };
    }

    const messageId = responseBody?.messages?.[0]?.id;
    if (!messageId) return { success: false, error: `No message ID in response: ${JSON.stringify(responseBody)}` };

    return { success: true, messageId };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Utility: sleep
 */
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/**
 * Worker main: subscribe to topic and process messages.
 * This implementation enforces exact messages-per-second rate by chunking into per-second slices.
 */
async function startBroadcastWorker(workerId, kafkaTopic) {
  const GROUP_ID = `whatsapp-broadcaster-${kafkaTopic}`;
  console.log(`[WORKER ${workerId}] Starting | Topic: ${kafkaTopic} | Group: ${GROUP_ID}`);

  const { db } = await connectToDatabase();

  const kafka = new Kafka({
    clientId: `whatsapp-worker-${workerId}-${kafkaTopic}`,
    brokers: KAFKA_BROKERS,
    connectionTimeout: 5000,
    requestTimeout: 30000,
  });

  const consumer = kafka.consumer({
    groupId: GROUP_ID,
    sessionTimeout: 60000,
    rebalanceTimeout: 90000,
    heartbeatInterval: 3000,
  });

  const run = async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: kafkaTopic, fromBeginning: false });
    console.log(`[WORKER ${workerId}] Connected to Kafka and subscribed to '${kafkaTopic}'.`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        let parsed;
        try {
          if (!message.value) return;
          parsed = JSON.parse(message.value.toString());
        } catch (e) {
          console.error(`[WORKER ${workerId}] Failed to JSON.parse message`, e);
          return;
        }

        const jobDetails = parsed.jobDetails;
        let contacts = parsed.contacts;
        if (!jobDetails || !jobDetails._id || !Array.isArray(contacts)) {
          console.error(`[WORKER ${workerId}] Invalid message payload, skipping.`);
          return;
        }

        const broadcastId = new ObjectId(jobDetails._id);
        const projectId = new ObjectId(jobDetails.projectId);
        const mps = Number(jobDetails.messagesPerSecond) || 80; // target messages per second (exact)

        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[WORKER ${workerId}] Picked batch of ${contacts.length} contacts. Throttle: ${mps} MPS.`);

        // Ensure contact ids are strings for lookups
        contacts = contacts.map(c => ({ _id: String(c._id), phone: c.phone, variables: c.variables || {} }));

        // We'll send EXACTLY up to mps messages every second.
        // Create chunks of size mps
        const chunks = [];
        for (let i = 0; i < contacts.length; i += mps) {
          chunks.push(contacts.slice(i, i + mps));
        }

        let totalSuccess = 0;
        let totalFailed = 0;

        // process each chunk (one chunk per second)
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];

          // Launch all sends concurrently for this second
          const startSec = Date.now();
          const promises = chunk.map(async contact => {
            // send heartbeat before each send to keep consumer session alive
            try { await heartbeat(); } catch (_) {}
            return sendWhatsAppMessage(jobDetails, contact).then(res => ({ contactId: contact._id, ...res }));
          });

          const results = await Promise.allSettled(promises);

          const bulkOps = [];
          let batchSuccess = 0;
          let batchError = 0;

          for (const r of results) {
            if (r.status !== 'fulfilled' || !r.value) {
              batchError++;
              continue;
            }
            const { contactId, success, messageId, error } = r.value;
            if (!contactId) {
              batchError++;
              continue;
            }
            if (success) {
              batchSuccess++;
              bulkOps.push({
                updateOne: {
                  filter: { _id: new ObjectId(contactId) },
                  update: { $set: { status: 'SENT', sentAt: new Date(), messageId, error: null } }
                }
              });
            } else {
              batchError++;
              bulkOps.push({
                updateOne: {
                  filter: { _id: new ObjectId(contactId) },
                  update: { $set: { status: 'FAILED', error } }
                }
              });
            }
          }

          if (bulkOps.length > 0) {
            try {
              await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
            } catch (e) {
              console.error(`[WORKER ${workerId}] bulkWrite failed:`, e);
            }
          }

          // Atomically increment counts on job
          let updatedJob;
          try {
            updatedJob = await db.collection('broadcasts').findOneAndUpdate(
              { _id: broadcastId },
              { $inc: { successCount: batchSuccess, errorCount: batchError } },
              { returnDocument: 'after' }
            );
          } catch (e) {
            console.error(`[WORKER ${workerId}] Failed to update job counts:`, e);
          }

          totalSuccess += batchSuccess;
          totalFailed += batchError;

          // Log batch
          const duration = (Date.now() - startSec) / 1000;
          const actualMPS = (batchSuccess + batchError) / (duration || 1);
          await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[WORKER ${workerId}] Chunk ${idx + 1}/${chunks.length} finished in ${duration.toFixed(2)}s (~${Math.round(actualMPS)} MPS). Success: ${batchSuccess}, Failed: ${batchError}.`);

          // If job reached complete, mark Completed and stop processing further chunks
          try {
            const finalJobState = updatedJob && updatedJob.value ? updatedJob.value : await db.collection('broadcasts').findOne({ _id: broadcastId });
            if (finalJobState && (finalJobState.successCount + finalJobState.errorCount) >= finalJobState.contactCount) {
              await db.collection('broadcasts').updateOne(
                { _id: broadcastId, status: 'PROCESSING' },
                { $set: { status: 'Completed', completedAt: new Date() } }
              );
              await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[WORKER ${workerId}] Job completed while processing chunk ${idx + 1}. Marked as Completed.`);
              break;
            }
          } catch (e) {
            console.error(`[WORKER ${workerId}] Error while checking completion:`, e);
          }

          // Wait until 1 second from startSec has passed before starting next chunk to respect exact mps
          const elapsed = Date.now() - startSec;
          if (elapsed < 1000) {
            await sleep(1000 - elapsed);
          }
        } // end chunks loop

        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[WORKER ${workerId}] Finished message batch processing. TotalSuccess: ${totalSuccess}, TotalFailed: ${totalFailed}.`);
      }
    });
  }; // end run

  run().catch(async (err) => {
    console.error(`[WORKER ${workerId}] Consumer run failed, will attempt restart:`, err);
    try { await consumer.disconnect(); } catch (e) { /* ignore */ }
    setTimeout(() => run(), 5000);
  });
}

module.exports = { startBroadcastWorker };
