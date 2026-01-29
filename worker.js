
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { MongoClient, ObjectId } = require('mongodb');
const undici = require('undici');
const axios = require('axios'); // For utility function

// --- INLINED MONGODB WORKER ---
if (!process.env.MONGODB_URI) throw new Error('Please define the MONGODB_URI environment variable inside .env');
if (!process.env.MONGODB_DB) throw new Error('Please define the MONGODB_DB environment variable inside .env');
let cachedClient = null;
let cachedDb = null;
async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };
  const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

// --- INLINED UTILS WORKER ---
const getErrorMessage = (error) => {
    if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data?.error;
        if (apiError && typeof apiError === 'object') {
            let message = apiError.error_user_title 
                ? `${apiError.error_user_title}: ${apiError.error_user_msg}` 
                : apiError.message || 'An unknown API error occurred.';
            if (apiError.code) message += ` (Code: ${apiError.code})`;
            if (apiError.error_subcode) message += ` (Subcode: ${apiError.error_subcode})`;
            if (apiError.error_data?.details) message += ` Details: ${apiError.error_data.details}`;
            return message;
        }
        try { return `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`; }
        catch (e) { return `Request failed with status ${error.response.status}: An unexpected response was received from the server.`; }
    }
    if (axios.isAxiosError(error) && error.request) return 'No response received from server. Check network connectivity.';
    if (error instanceof Error) {
        if ('cause' in error && error.cause) return getErrorMessage(error.cause);
        return error.message;
    }
    if (typeof error === 'object' && error !== null) return JSON.stringify(error);
    return String(error) || 'An unknown error occurred';
};


// --- CORE WORKER LOGIC ---
const API_VERSION = 'v23.0';
const LOG_PREFIX = '[BROADCAST-WORKER]';

async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
  try {
    await db.collection('broadcast_logs').insertOne({ broadcastId, projectId, level, message, meta, timestamp: new Date() });
  } catch (e) {
    console.error(`${LOG_PREFIX} Failed to write log:`, e);
  }
}

function interpolateText(text, contact) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/{{(.*?)}}/g, (match, key) => {
        const trimmedKey = key.trim();
        return contact[trimmedKey] !== undefined ? contact[trimmedKey] : match;
    });
}

async function sendWhatsAppMessage(job, contact, agent) {
  try {
    const { accessToken, phoneNumberId, templateName, language = 'en_US', components } = job;
    const interpolatedComponents = JSON.parse(JSON.stringify(components || []));

    if (interpolatedComponents) {
        interpolatedComponents.forEach(component => {
            if (component.parameters) {
                component.parameters.forEach(param => {
                    if (param.type === 'text' && param.text) {
                       param.text = interpolateText(param.text, contact);
                    }
                });
            }
        });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: contact.phone,
      type: 'template',
      template: { name: templateName, language: { code: language }, components: interpolatedComponents },
    };

    const response = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      { method: 'POST', dispatcher: agent, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(payload), throwOnError: false }
    );

    const json = await response.body.json().catch(() => null);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return { success: true, messageId: json?.messages?.[0]?.id || null };
    }

    return { success: false, error: JSON.stringify(json?.error || json) };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

async function startBroadcastWorker(workerId) {
  const { db } = await connectToDatabase();
  const pThrottleLib = await import('p-throttle');
  const pThrottle = pThrottleLib.default;
  const agent = new undici.Agent({ connections: 200, pipelining: 1 });

  console.log(`${LOG_PREFIX} Worker ${workerId} started. Polling for jobs every 5 seconds.`);

  setInterval(async () => {
    let job = null;
    try {
      job = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'PENDING_PROCESSING' },
        { $set: { status: 'PROCESSING', workerId, startedAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!job) return;

      const { _id: broadcastId, projectId, messagesPerSecond } = job;
      await addBroadcastLog(db, broadcastId, projectId, "INFO", `Worker ${workerId} picked up job.`);

      const throttle = pThrottle({ limit: messagesPerSecond || 80, interval: 1000 });
      const throttledSend = throttle(async (contact) => {
        const result = await sendWhatsAppMessage(job, contact, agent);
        if (result.success) {
          await db.collection("broadcast_contacts").updateOne({ _id: contact._id }, { $set: { status: "SENT", sentAt: new Date(), messageId: result.messageId, error: null } });
        } else {
          await db.collection("broadcast_contacts").updateOne({ _id: contact._id }, { $set: { status: "FAILED", error: result.error } });
        }
      });

      const cursor = db.collection('broadcast_contacts').find({ broadcastId, status: { $ne: 'SENT' } });
      for await (const contact of cursor) {
        await throttledSend(contact);
      }
      
      const successCount = await db.collection('broadcast_contacts').countDocuments({ broadcastId, status: 'SENT' });
      const failedCount = await db.collection('broadcast_contacts').countDocuments({ broadcastId, status: 'FAILED' });

      await addBroadcastLog(db, broadcastId, projectId, "INFO", `Finished processing. Sent: ${successCount}, Failed: ${failedCount}`);

      await db.collection('broadcasts').updateOne(
        { _id: broadcastId },
        { $set: { status: 'Completed', completedAt: new Date(), successCount, errorCount: failedCount } }
      );

    } catch (e) {
      console.error(`${LOG_PREFIX} Worker ${workerId} CRITICAL ERROR:`, getErrorMessage(e));
      if (job?._id) {
        await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'FAILED_PROCESSING', error: getErrorMessage(e) } });
      }
    }
  }, 5000);
}

// Main execution
function main() {
  const workerId = process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-cluster-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;
  console.log(`${LOG_PREFIX} Worker starting with ID: ${workerId}`);
  startBroadcastWorker(workerId).catch(err => {
    console.error(`${LOG_PREFIX} CRITICAL ERROR during worker initialization.`, err);
    process.exit(1);
  });
}

main();
