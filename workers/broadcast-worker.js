require('dotenv').config();
const path = require('path');

const { connectToDatabase } = require('../src/lib/mongodb.js');
const { getErrorMessage } = require('../src/lib/utils.js');

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
    const headerComponent = components.find(c => c.type === 'HEADER');

    if (headerComponent) {
      const format = headerComponent.format?.toLowerCase();
      let parameter;

      if (['image', 'video', 'document'].includes(format)) {
        if (headerMediaId) parameter = { type: format, [format]: { id: headerMediaId } };
        else if (headerImageUrl) parameter = { type: format, [format]: { link: headerImageUrl } };
      } else if (format === 'text' && headerComponent.text) {
        const headerVars = getVars(headerComponent.text);
        if (headerVars.length > 0) {
            const varKey = `header_variable${headerVars[0]}`;
            const value = contact.variables?.[varKey] || '';
            if (value) parameter = { type: 'text', text: value };
        }
      }

      if (parameter) payloadComponents.push({ type: 'header', parameters: [parameter] });
    }

    const bodyComponent = components.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const bodyVars = getVars(bodyComponent.text);
      if (bodyVars.length > 0) {
        const parameters = bodyVars
          .sort((a, b) => a - b)
          .map(varNum => {
            const mapping = variableMappings?.find(m => m.var === String(varNum));
            const varKey = mapping ? mapping.value : `body_variable${varNum}`;
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
        `Meta API error ${statusCode}: ${JSON.stringify(responseData?.error || responseData)}`
      );
    }

    const messageId = responseData?.messages?.[0]?.id;
    if (!messageId) return { success: false, error: "No message ID returned from Meta." };

    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function startBroadcastWorker(workerId) {
  const pThrottle = await importPThrottle();
  const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'low-priority-broadcasts';
  const GROUP_ID = `whatsapp-broadcaster-${KAFKA_TOPIC}`;

  console.log(`[WORKER ${workerId}] Starting on topic: ${KAFKA_TOPIC} at ${new Date().toISOString()}`);

  const { db } = await connectToDatabase();

  const kafka = new Kafka({
    clientId: `whatsapp-worker-${workerId}-${KAFKA_TOPIC}`,
    brokers: KAFKA_BROKERS,
    connectionTimeout: 5000,
    requestTimeout: 30000,
  });

  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      let broadcastId, projectId;

      try {
        if (!message.value) return;

        const { jobDetails, contacts } = JSON.parse(message.value.toString());
        if (!jobDetails || !jobDetails._id || !Array.isArray(contacts)) return;

        const { ObjectId } = require('mongodb');
        broadcastId = new ObjectId(jobDetails._id);
        projectId = new ObjectId(jobDetails.projectId);
        const mps = jobDetails.messagesPerSecond || 80;

        console.log(`[WORKER ${workerId}] Processing ${contacts.length} contacts for broadcast ${broadcastId}`);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Worker picked batch of ${contacts.length}. Throttle: ${mps} MPS.`);

        const throttle = pThrottle({ limit: mps, interval: 1000 });
        const throttledSend = throttle(async contact => {
          await heartbeat();
          return sendWhatsAppMessage(jobDetails, contact).then(result => ({ contactId: contact._id, ...result }));
        });

        let successCount = 0;
        let errorCount = 0;
        const results = [];

        // Stop sending if total sent + failed >= contacts.length
        for (const contact of contacts) {
          if (successCount + errorCount >= contacts.length) break;
          const res = await throttledSend(contact);
          results.push(res);
          if (res.success) successCount++;
          else errorCount++;
        }

        const bulkOps = results.map(r => ({
          updateOne: {
            filter: { _id: new ObjectId(r.contactId) },
            update: r.success
              ? { $set: { status: 'SENT', sentAt: new Date(), messageId: r.messageId, error: null } }
              : { $set: { status: 'FAILED', error: r.error } }
          }
        }));

        if (bulkOps.length) await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });

        // Update job counts
        const updatedJob = await db.collection('broadcasts').findOneAndUpdate(
          { _id: broadcastId },
          { $inc: { successCount, errorCount } },
          { returnDocument: 'after' }
        );

        if (updatedJob.value && (updatedJob.value.successCount + updatedJob.value.errorCount) >= updatedJob.value.contactCount) {
          await db.collection('broadcasts').updateOne(
            { _id: broadcastId },
            { $set: { status: 'Completed', completedAt: new Date() } }
          );
          console.log(`[WORKER ${workerId}] [JOB ${broadcastId}] Job marked as Completed.`);
          await addBroadcastLog(db, broadcastId, projectId, 'INFO', 'Job marked as Completed.');
        }

        console.log(`[WORKER ${workerId}] [JOB ${broadcastId}] Batch finished. Success: ${successCount}, Failed: ${errorCount}.`);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Batch finished. Success: ${successCount}, Failed: ${errorCount}.`);
      } catch (err) {
        console.error(`[WORKER ${workerId}] [JOB ${broadcastId}] Critical error:`, err);
        if(broadcastId && projectId) {
          await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Worker failed processing batch: ${getErrorMessage(err)}`);
        }
      }
    }
  });
}

module.exports = { startBroadcastWorker };
