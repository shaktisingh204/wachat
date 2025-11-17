
require('dotenv').config();
const { connectToDatabase } = require('../lib/mongodb.js');
const { getErrorMessage } = require('../lib/utils.js');
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
  console.error('[KAFKA-WORKER] FATAL: KAFKA_BROKERS environment variable is not set. Worker cannot start.');
  process.exit(1);
}

const API_VERSION = 'v23.0';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(',');

/**
 * Logs a message to the dedicated broadcast log collection in MongoDB.
 * @param {import('mongodb').Db} db - The MongoDB database instance.
 * @param {ObjectId} broadcastId - The ID of the broadcast job.
 * @param {ObjectId} projectId - The ID of the project.
 * @param {'INFO' | 'ERROR' | 'WARN'} level - The log level.
 * @param {string} message - The log message.
 * @param {object} [meta={}] - Additional metadata to log.
 */
async function addBroadcastLog(db, broadcastId, projectId, level, message, meta) {
    try {
        if (!db || !broadcastId || !projectId) return;
        await db.collection('broadcast_logs').insertOne({
            broadcastId: new ObjectId(broadcastId),
            projectId: new ObjectId(projectId),
            level,
            message,
            meta,
            timestamp: new Date(),
        });
    } catch (e) {
        console.error(`[WORKER] Failed to write log for job ${broadcastId}:`, e);
    }
}

/**
 * Sends a single WhatsApp message using the Meta Graph API.
 * @param {object} job - The sanitized broadcast job details.
 * @param {object} contact - The contact object.
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>} - The result of the send operation.
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

    const getVars = (text) => text ? [...new Set((text.match(/{{\s*(\d+)\s*}}/g) || []).map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
    
    const interpolate = (text, variables) => {
      if (!text) return '';
      return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (m, key) =>
        variables[key] !== undefined ? String(variables[key]) : m
      );
    };

    const payloadComponents = [];
    const headerComponent = components?.find(c => c.type === 'HEADER');
    if (headerComponent) {
      let parameter;
      const format = headerComponent.format?.toLowerCase();
      if (headerMediaId) {
        parameter = { type: format, [format]: { id: headerMediaId } };
      } else if (headerImageUrl) {
        parameter = { type: format, [format]: { link: headerImageUrl } };
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
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(messageData) }
    );

    const responseBody = await response.body.json();
    if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`Meta API error ${response.statusCode}: ${JSON.stringify(responseBody?.error || responseBody)}`);
    const messageId = responseBody?.messages?.[0]?.id;
    if (!messageId) return { success: false, error: "No message ID returned from Meta." };

    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Main worker function that connects to Kafka and processes message batches.
 * @param {string} workerId - A unique identifier for this worker instance.
 * @param {string} kafkaTopic - The Kafka topic to subscribe to.
 */
async function startBroadcastWorker(workerId, kafkaTopic) {
  const pThrottle = await importPThrottle();
  const GROUP_ID = `whatsapp-broadcaster-${kafkaTopic}`;

  console.log(`[WORKER ${workerId}] Starting on topic: ${kafkaTopic}`);

  const { db } = await connectToDatabase();

  const kafka = new Kafka({
    clientId: `whatsapp-worker-${workerId}-${kafkaTopic}`,
    brokers: KAFKA_BROKERS
  });

  const consumer = kafka.consumer({
    groupId: GROUP_ID,
    sessionTimeout: 60000,
    rebalanceTimeout: 90000,
    heartbeatInterval: 3000
  });

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaTopic, fromBeginning: false });

  console.log(`[WORKER ${workerId}] Connected to Kafka and subscribed to topic '${kafkaTopic}'.`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      try {
        if (!message.value) return;

        const { jobDetails, contacts } = JSON.parse(message.value.toString());
        if (!jobDetails || !jobDetails._id || !Array.isArray(contacts) || contacts.length === 0) {
          console.error(`[WORKER ${workerId}] Invalid job data received.`);
          return;
        }

        const broadcastId = new ObjectId(jobDetails._id);
        const projectId = new ObjectId(jobDetails.projectId);
        const mps = jobDetails.messagesPerSecond || 80;

        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[WORKER ${workerId}] Picked batch of ${contacts.length}. Throttle: ${mps} MPS.`);

        const throttle = pThrottle({ limit: mps, interval: 1000 });

        const throttledSend = throttle(async contact => {
          await heartbeat();
          return sendWhatsAppMessage(jobDetails, contact).then(result => ({
            contactId: contact._id,
            ...result
          }));
        });

        const results = await Promise.allSettled(
          contacts.map(contact => throttledSend(contact))
        );

        const bulkOps = [];
        let batchSuccessCount = 0;
        let batchErrorCount = 0;

        for (const r of results) {
          if (r.status !== 'fulfilled' || !r.value) {
            batchErrorCount++;
            continue;
          }

          const { contactId, success, messageId, error } = r.value;
          if (!contactId) {
             batchErrorCount++;
             continue;
          }

          bulkOps.push({
            updateOne: {
              filter: { _id: new ObjectId(contactId) },
              update: success
                ? { $set: { status: 'SENT', sentAt: new Date(), messageId, error: null } }
                : { $set: { status: 'FAILED', error } }
            }
          });

          if (success) batchSuccessCount++; else batchErrorCount++;
        }

        if (bulkOps.length > 0) {
          await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
        }

        // Atomically update counts and fetch the result in one operation
        const updatedJobResult = await db.collection('broadcasts').findOneAndUpdate(
            { _id: broadcastId },
            { $inc: { successCount: batchSuccessCount, errorCount: batchErrorCount } },
            { returnDocument: 'after' }
        );
        
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[WORKER ${workerId}] Finished batch. Success: ${batchSuccessCount}, Failed: ${batchErrorCount}.`);
        
        // Finalization logic
        const finalJobState = updatedJobResult;
        if (finalJobState && (finalJobState.successCount + finalJobState.errorCount) >= finalJobState.contactCount) {
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId, status: 'PROCESSING' },
                { $set: { status: 'Completed', completedAt: new Date() } }
            );
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', '[WORKER] All contacts processed. Job marked as Completed.');
        }

      } catch (err) {
        console.error(`[WORKER ${workerId}] CRITICAL ERROR processing Kafka message:`, err);
      }
    }
  });
}

module.exports = { startBroadcastWorker };
