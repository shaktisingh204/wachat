require('dotenv').config();
const { Kafka } = require('kafkajs');
const undici = require('undici');
const { connectToDatabase } = require('../src/lib/mongodb.js');
const { getErrorMessage } = require('../src/lib/utils.js');

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const API_VERSION = 'v23.0';

async function sendWhatsAppMessage(job, contact) {
    try {
        const { accessToken, phoneNumberId, templateName, language, components, variableMappings } = job;

        const getVars = (text) => text ? [...new Set((text.match(/{{\s*(\d+)\s*}}/g) || []).map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
        const payloadComponents = [];

        const header = components?.find(c => c.type === 'HEADER');
        if (header?.text) {
            const parameters = getVars(header.text).map(v => ({ type: 'text', text: contact.variables?.[`header_variable${v}`] || '' }));
            payloadComponents.push({ type: 'header', parameters });
        }

        const body = components?.find(c => c.type === 'BODY');
        if (body?.text) {
            const parameters = getVars(body.text).map(v => {
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

        // Fixed variable name conflict
        const response = await undici.request(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
            { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );

        const responseData = await response.body.json();
        if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(JSON.stringify(responseData?.error || responseData));

        return { success: true, messageId: responseData?.messages?.[0]?.id };
    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}

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

            if (updatedJob.value && (updatedJob.value.successCount + updatedJob.value.errorCount) >= updatedJob.value.contactCount) {
                await db.collection('broadcasts').updateOne({ _id: jobDetails._id }, { $set: { status: 'Completed', completedAt: new Date() } });
            }
        }
    });
}

module.exports = { startBroadcastWorker };
