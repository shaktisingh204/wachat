

require('dotenv').config();
const path = require('path');
const { connectToDatabase } = require('../lib/mongodb.js');

const { getErrorMessage } = require('../lib/utils.js');
const { Kafka } = require('kafkajs');
const undici = require('undici');

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

async function addBroadcastLog(db, broadcastId, projectId, level, message, meta) {
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


// ---------------------------
// SEND WABA MESSAGE
// ---------------------------
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

    // Detect {{1}}, {{2}} ...
    const getVars = (text) => {
      if (!text) return [];
      const matches = text.match(/{{\s*(\d+)\s*}}/g);
      return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
    };

    const interpolate = (text, variables) => {
      if (!text) return '';
      return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (m, key) =>
        variables[key] !== undefined ? String(variables[key]) : m
      );
    };

    const payloadComponents = [];

    // HEADER
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
          parameter = {
            type: 'text',
            text: interpolate(headerComponent.text, contact.variables || {})
          };
        }
      }

      if (parameter) {
        payloadComponents.push({ type: 'header', parameters: [parameter] });
      }
    }

    // BODY
    const bodyComponent = components.find(c => c.type === 'BODY');
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

    // FINAL WHATSAPP PAYLOAD
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

    const { statusCode, body } = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      }
    );

    const responseData = await body.json();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(
        `Meta API error ${statusCode}: ${JSON.stringify(responseData)}`
      );
    }

    const messageId = responseData?.messages?.[0]?.id;
    if (!messageId) return { success: false, error: "No message ID returned." };

    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

// --------------------------------------------
// MAIN WORKER START FUNCTION
// --------------------------------------------
async function startBroadcastWorker(workerId) {
  const pThrottle = await importPThrottle();
  const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'low-priority-broadcasts';
  const GROUP_ID = `whatsapp-broadcaster-${KAFKA_TOPIC}`;

  console.log(`[WORKER ${workerId}] Starting on topic: ${KAFKA_TOPIC}`);

  const { db } = await connectToDatabase();

  const kafka = new Kafka({
    clientId: `whatsapp-worker-${workerId}-${KAFKA_TOPIC}`,
    brokers: KAFKA_BROKERS
  });

  const consumer = kafka.consumer({
    groupId: GROUP_ID,
    sessionTimeout: 60000,
    rebalanceTimeout: 90000,
    heartbeatInterval: 3000
  });

  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });

  console.log(`[WORKER ${workerId}] Connected to Kafka.`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
      const pausable = pause();
      if (pausable) pausable.pause();

      try {
        if (!message.value) return;

        const { jobDetails, contacts } = JSON.parse(message.value.toString());

        if (!jobDetails || !jobDetails._id || !Array.isArray(contacts)) {
          console.error(`[WORKER ${workerId}] Invalid job data.`);
          return;
        }

        const { ObjectId } = require('mongodb');
        const broadcastId = new ObjectId(jobDetails._id);
        const projectId = new ObjectId(jobDetails.projectId);
        const mps = jobDetails.projectMessagesPerSecond || 80;

        await addBroadcastLog(
          db,
          broadcastId,
          projectId,
          'INFO',
          `Worker picked batch of ${contacts.length}. Throttle: ${mps} MPS.`
        );

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
        let successCount = 0;
        let errorCount = 0;

        for (const r of results) {
          if (r.status !== 'fulfilled') {
            errorCount++;
            continue;
          }

          const { contactId, success, messageId, error } = r.value;

          bulkOps.push({
            updateOne: {
              filter: { _id: new ObjectId(contactId) },
              update: success
                ? {
                    $set: {
                      status: 'SENT',
                      sentAt: new Date(),
                      messageId,
                      error: null
                    }
                  }
                : { $set: { status: 'FAILED', error } }
            }
          });

          success ? successCount++ : errorCount++;
        }

        if (bulkOps.length) {
          await db
            .collection('broadcast_contacts')
            .bulkWrite(bulkOps, { ordered: false });
        }

        await db.collection('broadcasts').updateOne(
          { _id: broadcastId },
          { $inc: { successCount, errorCount } }
        );

        await addBroadcastLog(
          db,
          broadcastId,
          projectId,
          'INFO',
          `Batch done. Success: ${successCount}, Failed: ${errorCount}.`
        );
      } catch (err) {
        console.error(`[WORKER ${workerId}] Error:`, err);
      } finally {
        if (pausable) pausable.resume();
      }
    }
  });
}

module.exports = { startBroadcastWorker };
