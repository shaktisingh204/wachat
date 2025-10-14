
require('dotenv').config();
const path = require('path');
const { connectToDatabase } = require(path.join(__dirname, 'mongodb.ts'));
const { getErrorMessage } = require(path.join(__dirname, 'utils.ts'));
const axios = require('axios');
const { ObjectId } = require('mongodb');
const { Kafka } = require('kafkajs');

// This needs to be a dynamic import because p-throttle is an ESM-only package
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
const KAFKA_TOPIC = 'messages';
const GROUP_ID = 'whatsapp-broadcaster-group';

const addBroadcastLog = async (db, broadcastId, projectId, level, message, meta) => {
    try {
        if (!db || !broadcastId || !projectId) return;
        await db.collection('broadcast_logs').insertOne({
            broadcastId,
            projectId,
            level,
            message,
            meta,
            timestamp: new Date(),
        });
    } catch (e) {
        console.error("Failed to write broadcast log in worker:", e);
    }
};

/**
 * Sends a single WhatsApp message.
 */
async function sendWhatsAppMessage(job, contact) {
    try {
        const { accessToken, phoneNumberId, templateName, language, components, headerImageUrl, headerMediaId, variableMappings } = job;
        
        const getVars = (text) => {
            if (!text) return [];
            const matches = text.match(/{{\s*(\d+)\s*}}/g);
            return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
        };

        const interpolate = (text, variables) => {
            if (!text) return '';
            return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (match, key) => {
                const value = variables[key];
                return value !== undefined ? String(value) : match;
            });
        };

        const payloadComponents = [];
        const headerComponent = components.find(c => c.type === 'HEADER');
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
        
        const bodyComponent = components.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const bodyVars = getVars(bodyComponent.text);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => {
                    const mapping = variableMappings?.find(m => m.var === String(varNum));
                    const varKey = mapping ? mapping.value : `variable${varNum}`;
                    const value = contact.variables?.[varKey] || '';
                    return { type: 'text', text: value };
                });
                payloadComponents.push({ type: 'body', parameters });
            }
        }
        
        const messageData = {
            messaging_product: 'whatsapp', to: contact.phone, recipient_type: 'individual', type: 'template',
            template: { name: templateName, language: { code: language || 'en_US' }, ...(payloadComponents.length > 0 && { components: payloadComponents }) },
        };
        
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, messageData, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        
        const messageId = response.data?.messages?.[0]?.id;
        if (!messageId) return { success: false, error: "No message ID returned from Meta." };

        return { success: true, messageId };
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        return { success: false, error: errorMessage };
    }
}

/**
 * Main worker function. Consumes jobs from Kafka and sends WhatsApp messages.
 */
async function startBroadcastWorker(workerId) {
  const pThrottle = await importPThrottle();
  console.log(`[KAFKA-WORKER ${workerId}] Connecting with brokers: ${KAFKA_BROKERS}`);
  const { db } = await connectToDatabase();
  const kafka = new Kafka({
    clientId: `whatsapp-worker-${workerId}`,
    brokers: KAFKA_BROKERS,
  });
  const consumer = kafka.consumer({ groupId: GROUP_ID });

  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });
  console.log(`[KAFKA-WORKER ${workerId}] Connected and subscribed to topic "${KAFKA_TOPIC}"`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) {
          console.warn(`[KAFKA-WORKER ${workerId}] Received an empty message from Kafka. Skipping.`);
          return;
        }

        const { jobDetails, contacts } = JSON.parse(message.value.toString());
        
        if (!jobDetails || !jobDetails._id || !Array.isArray(contacts) || contacts.length === 0) {
            const errorMessage = `[KAFKA-WORKER ${workerId}] Received invalid job data from Kafka. Skipping batch.`;
            console.error(errorMessage, { jobDetails, contactCount: contacts?.length });
            const broadcastId = jobDetails?._id ? new ObjectId(jobDetails._id) : null;
            const projectId = jobDetails?.projectId ? new ObjectId(jobDetails.projectId) : null;
            if (broadcastId && projectId) {
                await addBroadcastLog(db, broadcastId, projectId, 'ERROR', 'Worker received invalid job data.', { workerId, receivedData: message.value.toString() });
            }
            return;
        }
        
        const broadcastId = new ObjectId(jobDetails._id);
        const projectId = new ObjectId(jobDetails.projectId);

        const mps = jobDetails.projectMessagesPerSecond || jobDetails.messagesPerSecond || 50; 
        
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Worker ${workerId} picked up batch of ${contacts.length} contacts. Throttling at ${mps} MPS.`, { mps });

        // Create a throttled function that respects the MPS limit
        const throttle = pThrottle({
            limit: mps,
            interval: 1000
        });

        const throttledSendMessage = throttle(async (contact) => {
            return sendWhatsAppMessage(jobDetails, contact).then(result => ({ contactId: contact._id, ...result }));
        });

        // Map all contacts to throttled promises and execute in parallel
        const contactPromises = contacts.map(contact => throttledSendMessage(contact));

        const results = await Promise.allSettled(contactPromises);

        const bulkOps = [];
        let successCount = 0;
        let errorCount = 0;

        for (const res of results) {
            if (res.status === 'fulfilled') {
                const { contactId, success, messageId, error } = res.value;
                if (success) {
                    successCount++;
                    bulkOps.push({ updateOne: { filter: { _id: new ObjectId(contactId) }, update: { $set: { status: 'SENT', sentAt: new Date(), messageId, error: null } } } });
                } else {
                    errorCount++;
                    bulkOps.push({ updateOne: { filter: { _id: new ObjectId(contactId) }, update: { $set: { status: 'FAILED', error } } } });
                }
            } else {
                errorCount++;
                console.error(`[KAFKA-WORKER ${workerId}] A throttled promise was rejected:`, res.reason);
            }
        }
        
        if (bulkOps.length > 0) {
            await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
        }
        
        if (successCount > 0 || errorCount > 0) {
            await db.collection('broadcasts').updateOne(
              { _id: broadcastId },
              { $inc: { successCount, errorCount } }
            );
        }

        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Worker ${workerId} finished processing batch of ${contacts.length}. Success: ${successCount}, Failed: ${errorCount}.`);

      } catch (err) {
        console.error(`[KAFKA-WORKER ${workerId}] Error processing message from Kafka:`, err);
      }
    },
  });
}

module.exports = { startBroadcastWorker };
