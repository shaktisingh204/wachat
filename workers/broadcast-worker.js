
'use strict';

require('dotenv').config();
const { connectToDatabase } = require('../src/lib/mongodb.js');
const { getErrorMessage } = require('../src/lib/utils.js');
const { Kafka } = require('kafkajs');
const undici = require('undici');
const { ObjectId } = require('mongodb');

// Ensure KAFKA_BROKERS is set
if (!process.env.KAFKA_BROKERS) {
  console.error('[WORKER] FATAL: KAFKA_BROKERS environment variable is not set.');
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
 * Sends a single WhatsApp template message via Meta Graph API.
 */
async function sendWhatsAppMessage(job, contact) {
  try {
    const {
      accessToken, phoneNumberId, templateName, language, components,
      headerImageUrl, headerMediaId, variableMappings
    } = job;

    const getVars = (text) => text ? [...new Set((text.match(/{{\s*(\d+)\s*}}/g) || []).map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
    
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
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
        throwOnError: false, // Handle non-2xx responses manually
        bodyTimeout: 20000,
      }
    );

    const responseBody = await response.body.json();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      const errorDetail = responseBody?.error ? JSON.stringify(responseBody.error) : JSON.stringify(responseBody);
      return { success: false, error: `Meta API error ${response.statusCode}: ${errorDetail}` };
    }

    const messageId = responseBody?.messages?.[0]?.id;
    if (!messageId) return { success: false, error: `No message ID in response: ${JSON.stringify(responseBody)}` };

    return { success: true, messageId };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * A precise rate-limiter that sends batches of functions at a specified interval.
 */
function createPreciseThrottler(rate, interval = 1000) {
    const queue = [];
    let isRunning = false;

    async function processQueue() {
        if (queue.length === 0) {
            isRunning = false;
            return;
        }
        isRunning = true;
        
        const itemsToProcess = queue.splice(0, rate);
        await Promise.allSettled(itemsToProcess.map(fn => fn()));

        setTimeout(processQueue, interval);
    }

    return (fn) => {
        queue.push(fn);
        if (!isRunning) {
            processQueue();
        }
    };
}


async function startBroadcastWorker(workerId, kafkaTopic) {
  const GROUP_ID = `whatsapp-broadcaster-v2`; // Use a versioned group ID
  console.log(`[WORKER ${workerId}] Starting | Topic: ${kafkaTopic} | Group: ${GROUP_ID}`);

  const { db } = await connectToDatabase();

  const kafka = new Kafka({
    clientId: `whatsapp-worker-${workerId}`,
    brokers: KAFKA_BROKERS
  });

  const consumer = kafka.consumer({
    groupId: GROUP_ID,
    sessionTimeout: 60000,
    rebalanceTimeout: 90000,
    heartbeatInterval: 3000,
    allowAutoTopicCreation: false,
  });

  const run = async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: kafkaTopic, fromBeginning: false });
    console.log(`[WORKER ${workerId}] Connected to Kafka and subscribed to '${kafkaTopic}'.`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        const pausable = pause();
        if (pausable) pausable.pause();

        let parsedMessage;
        try {
          if (!message.value) return;
          parsedMessage = JSON.parse(message.value.toString());
        } catch (e) {
          console.error(`[WORKER ${workerId}] Failed to JSON.parse message:`, e);
          if (pausable) pausable.resume();
          return;
        }

        const { jobDetails, contacts } = parsedMessage;
        const broadcastId = new ObjectId(String(jobDetails._id));
        const projectId = new ObjectId(String(jobDetails.projectId));

        try {
            if (!jobDetails || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
                await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `[WORKER ${workerId}] Invalid message payload received, skipping.`);
                return;
            }

            const mps = Number(jobDetails.messagesPerSecond) || 80;
            const throttle = createPreciseThrottler(mps, 1000);

            await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[WORKER ${workerId}] Started batch of ${contacts.length}. Throttle: ${mps} MPS.`);

            const sendPromises = contacts.map(contact => {
                return new Promise(resolve => {
                    throttle(async () => {
                        await heartbeat();
                        const result = await sendWhatsAppMessage(jobDetails, contact);
                        resolve({ contactId: contact._id, ...result });
                    });
                });
            });

            const results = await Promise.all(sendPromises);

            const bulkOps = [];
            let batchSuccessCount = 0;
            let batchErrorCount = 0;

            for (const r of results) {
              if (!r || !r.contactId) {
                batchErrorCount++;
                continue;
              }
              bulkOps.push({
                updateOne: {
                  filter: { _id: new ObjectId(String(r.contactId)) },
                  update: r.success
                    ? { $set: { status: 'SENT', sentAt: new Date(), messageId: r.messageId, error: null } }
                    : { $set: { status: 'FAILED', error: r.error } }
                }
              });
              if (r.success) batchSuccessCount++; else batchErrorCount++;
            }
            
            if (bulkOps.length > 0) {
              await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
            }

            const updatedJob = await db.collection('broadcasts').findOneAndUpdate(
                { _id: broadcastId },
                { $inc: { successCount: batchSuccessCount, errorCount: batchErrorCount } },
                { returnDocument: 'after' }
            );

            await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[WORKER ${workerId}] Finished batch. Success: ${batchSuccessCount}, Failed: ${batchErrorCount}.`);

            if (updatedJob && (updatedJob.successCount + updatedJob.errorCount) >= updatedJob.contactCount) {
                await db.collection('broadcasts').updateOne(
                    { _id: broadcastId, status: 'PROCESSING' },
                    { $set: { status: 'Completed', completedAt: new Date() } }
                );
                await addBroadcastLog(db, broadcastId, projectId, 'INFO', '[WORKER] All contacts processed. Job marked as Completed.');
            }
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            console.error(`[WORKER ${workerId}] CRITICAL ERROR processing Kafka message for job ${broadcastId}:`, errorMsg);
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `[WORKER ${workerId}] Critical error: ${errorMsg}`);
        } finally {
            if (pausable) pausable.resume();
        }
      }
    });
  };

  run().catch(async (err) => {
    console.error(`[WORKER ${workerId}] Consumer run failed, will attempt restart:`, err);
    try { await consumer.disconnect(); } catch (e) { console.error('Failed to disconnect consumer on error:', e); }
    setTimeout(() => run(), 5000);
  });
}

module.exports = { startBroadcastWorker };
