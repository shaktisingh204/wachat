
const path = require('path');
const { connectToDatabase } = require(path.join(__dirname, 'mongodb.ts'));
const { getErrorMessage } = require(path.join(__dirname, 'utils.ts'));
const axios = require('axios');
const { ObjectId } = require('mongodb');
const { Kafka } = require('kafkajs');

const API_VERSION = 'v23.0';
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const KAFKA_TOPIC = 'messages';
const GROUP_ID = 'whatsapp-broadcaster-group';

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
  console.log(`[KAFKA-WORKER ${workerId}] Connecting...`);
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
        const { jobDetails, contacts } = JSON.parse(message.value.toString());
        const mps = jobDetails.messagesPerSecond || 50; 

        console.log(`[KAFKA-WORKER ${workerId}] Processing batch of ${contacts.length} for broadcast ${jobDetails._id} at ${mps} MPS`);

        for (let i = 0; i < contacts.length; i += mps) {
            const chunk = contacts.slice(i, i + mps);
            const startTime = Date.now();
            
            const contactPromises = chunk.map(contact => 
              sendWhatsAppMessage(jobDetails, contact)
                  .then(result => ({ contactId: contact._id, ...result }))
            );
            
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
                    console.error(`[KAFKA-WORKER ${workerId}] A send promise was rejected:`, res.reason);
                }
            }

            if (bulkOps.length > 0) {
                await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
            }
            
            await db.collection('broadcasts').updateOne(
              { _id: new ObjectId(jobDetails._id) },
              { $inc: { successCount, errorCount } }
            );

            // Throttle to respect MPS
            const duration = Date.now() - startTime;
            const delay = 1000 - duration;
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        console.log(`[KAFKA-WORKER ${workerId}] Finished batch for broadcast ${jobDetails._id}.`);

      } catch (err) {
        console.error(`[KAFKA-WORKER ${workerId}] Error processing message from Kafka:`, err);
      }
    },
  });
}

module.exports = { startBroadcastWorker };
