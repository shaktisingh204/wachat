
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { MongoClient, ObjectId } = require('mongodb');
const undici = require('undici');
const FormData = require('form-data');

// --- DATABASE CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;
if (!MONGODB_URI || !MONGODB_DB) {
  throw new Error('Please define MONGODB_URI and MONGODB_DB environment variables');
}
let cachedClient = null;
let cachedDb = null;
async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };
  const client = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();
  const db = client.db(MONGODB_DB);
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

// --- UTILITIES ---
const getErrorMessage = (error) => {
    if (error?.response?.data?.error) {
        const apiError = error.response.data.error;
        let message = apiError.error_user_title 
            ? `${apiError.error_user_title}: ${apiError.error_user_msg}` 
            : apiError.message || 'An unknown API error occurred.';
        if (apiError.code) message += ` (Code: ${apiError.code})`;
        return message;
    }
    if (error?.isAxiosError && error.request) return 'No response from server.';
    if (error instanceof Error) return error.message;
    return String(error) || 'An unknown error occurred';
};

// --- WORKER LOGIC ---
const API_VERSION = 'v23.0';
const LOG_PREFIX = '[BROADCAST-WORKER]';

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
    console.error(`${LOG_PREFIX} Failed to write log:`, e);
  }
}

function interpolateText(text, variables) {
    if (!text || typeof text !== 'string') return text;
    if (!variables) return text;
    return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (match, key) => {
        const trimmedKey = key.trim();
        return variables[trimmedKey] !== undefined ? String(variables[trimmedKey]) : match;
    });
}

async function sendWhatsAppMessage(db, job, contact, agent) {
    try {
        const { accessToken, phoneNumberId, templateName, language = 'en_US', components, headerMediaFile } = job;
        
        const finalComponents = JSON.parse(JSON.stringify(components || []));
        const headerComponent = finalComponents.find(c => c.type === 'header');

        if (headerMediaFile && headerMediaFile.buffer && headerMediaFile.buffer.data && headerComponent?.parameters?.[0]) {
            const parameter = headerComponent.parameters[0];
            const mediaType = parameter.type;

            if (!parameter[mediaType]?.link && !parameter[mediaType]?.id) {
                const buffer = Buffer.from(headerMediaFile.buffer.data);
                const form = new FormData();
                form.append('file', buffer, { filename: headerMediaFile.name, contentType: headerMediaFile.type });
                form.append('messaging_product', 'whatsapp');
                
                const { statusCode, body } = await undici.request(
                    `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`,
                    { method: 'POST', dispatcher: agent, headers: { ...form.getHeaders(), Authorization: `Bearer ${accessToken}` }, body: form }
                );

                const uploadResponseData = await body.json().catch(() => null);

                if (statusCode >= 400) {
                    throw new Error(`Media upload failed: ${JSON.stringify(uploadResponseData?.error || 'Unknown upload error')}`);
                }
                
                const mediaId = uploadResponseData?.id;
                if (!mediaId) throw new Error("Meta API did not return a media ID after upload.");
                
                parameter[mediaType] = { id: mediaId };
            }
        }
        
        finalComponents.forEach(component => {
            if (component.parameters) {
                component.parameters.forEach(param => {
                    if (param.type === 'text' && param.text) {
                       param.text = interpolateText(param.text, contact.variables);
                    }
                });
            }
        });

        const payload = {
            messaging_product: 'whatsapp',
            to: contact.phone,
            type: 'template',
            template: {
                name: templateName,
                language: { code: language },
                components: finalComponents,
            },
        };

        const { statusCode, body } = await undici.request(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
            { method: 'POST', dispatcher: agent, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(payload) }
        );
        
        const responseData = await body.json().catch(() => null);

        if (statusCode >= 400) {
            throw new Error(`Meta API error ${statusCode}: ${JSON.stringify(responseData?.error || responseData)}`);
        }

        const messageId = responseData?.messages?.[0]?.id;
        if (!messageId) {
            return { success: false, error: "No message ID returned from Meta." };
        }

        return { success: true, messageId };

    } catch (err) {
        return { success: false, error: getErrorMessage(err) };
    }
}


async function startBroadcastWorker(workerId) {
  const { db } = await connectToDatabase();
  const pThrottleLib = await import('p-throttle');
  const pThrottle = pThrottleLib.default;
  const agent = new undici.Agent({ connections: 200, pipelining: 10 });

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

      const throttle = pThrottle({
          limit: messagesPerSecond || 80,
          interval: 1000
      });
      
      const throttledSend = throttle(async (contact) => {
        const result = await sendWhatsAppMessage(db, job, contact, agent);
        const updateQuery = result.success
            ? { $set: { status: "SENT", sentAt: new Date(), messageId: result.messageId, error: null } }
            : { $set: { status: "FAILED", error: result.error } };
        await db.collection("broadcast_contacts").updateOne({ _id: contact._id }, updateQuery);
      });

      const cursor = db.collection('broadcast_contacts').find({ broadcastId, status: 'PENDING' });
      
      const promises = [];
      for await (const contact of cursor) {
        promises.push(throttledSend(contact));
      }
      
      await Promise.all(promises);
      
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
