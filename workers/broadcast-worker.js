// broadcastWorker.js
require('dotenv').config();
const { Kafka } = require('kafkajs');
const undici = require('undici');
const { connectToDatabase } = require('../src/lib/mongodb.js');
const { getErrorMessage } = require('../src/lib/utils.js');

const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(',');
const API_VERSION = 'v23.0';

// Send WhatsApp message
async function sendWhatsAppMessage(job, contact) {
  try {
    const { accessToken, phoneNumberId, templateName, language, components, variableMappings } = job;

    const getVars = (text) => {
      if (!text) return [];
      const matches = text.match(/{{\s*(\d+)\s*}}/g);
      return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
    };

    const interpolate = (text, variables) => text.replace(/{{\s*([\w\d._]+)\s*}}/g, (m, key) =>
      variables[key] !== undefined ? String(variables[key]) : m
    );

    const payloadComponents = [];
    const headerComponent = components?.find(c => c.type === 'HEADER');
    if (headerComponent?.text) {
      const vars = getVars(headerComponent.text);
      const parameters = vars.map(v => ({ type: 'text', text: contact.variables?.[`header_variable${v}`] || '' }));
      payloadComponents.push({ type: 'header', parameters });
    }

    const bodyComponent = components?.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const vars = getVars(bodyComponent.text);
      const parameters = vars.map(v => {
        const mapping = variableMappings?.find(m => m.var === String(v));
        const varKey = mapping ? mapping.value : `body_variable${v}`;
        return { type: 'text', text: contact.variables?.[varKey] || '' };
      });
      payloadComponents.push({ type: 'body', parameters });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: contact.phone,
      recipient_type: 'individual',
      type: 'template',
      template: { name: templateName, language: { code: language || 'en_US' }, ...(payloadComponents.length && { components: payloadComponents }) }
    };

    const { statusCode, body } = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    const responseData = await body.json();
    if (statusCode < 200 || statusCode >= 300) throw new Error(JSON.stringify(responseData?.error || responseData));
    return { success: true, messageId: responseData?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

// Start Worker
async function startBroadcastWorker(workerId) {
  const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'low-priority-broadcasts';
  const { db } = await connectToDatabase();
  const kafka = new Kafka({ clientId: `worker-${workerId}`, brokers: KAFKA_BROKERS });
  const consumer = kafka.consumer({ groupId: `whatsapp-broadcaster-${KAFKA_TOPIC}` });

  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const { jobDetails, contacts } = JSON.parse(message.value.toString());
      if (!jobDetails || !contacts?.length) return;

      const speedLimit = jobDetails.messagesPerSecond || 80;
      const interval = 1000 / speedLimit;

      const bulkOps = [];
      let successCount = 0, errorCount = 0;

      for (const contact of contacts) {
        await new Promise(res => setTimeout(res, interval));
        const result = await sendWhatsAppMessage(jobDetails, contact);
        bulkOps.push(result.success
          ? { updateOne: { filter: { _id: contact._id }, update: { $set: { status: 'SENT', sentAt: new Date(), messageId: result.messageId, error: null } } } }
          : { updateOne: { filter: { _id: contact._id }, update: { $set: { status: 'FAILED', error: result.error } } } }
        );

        if (result.success) successCount++; else errorCount++;
      }

      if (bulkOps.length) await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });

      const updatedJob = await db.collection('broadcasts').findOneAndUpdate(
        { _id: jobDetails._id },
        { $inc: { successCount, errorCount } },
        { returnDocument: 'after' }
      );

      if (updatedJob && (updatedJob.successCount + updatedJob.errorCount) >= updatedJob.contactCount) {
        await db.collection('broadcasts').updateOne({ _id: jobDetails._id }, { $set: { status: 'Completed', completedAt: new Date() } });
      }
    }
  });
}

module.exports = { startBroadcastWorker };
