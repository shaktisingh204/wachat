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
  if (error instanceof Error) return error.message;
  return String(error) || 'Unknown error';
};

// --- WORKER LOGIC ---
const API_VERSION = 'v23.0';
const LOG_PREFIX = '[BROADCAST-WORKER]';

async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
  try {
    await db.collection('broadcast_logs').insertOne({
      broadcastId: new ObjectId(String(broadcastId)),
      projectId: new ObjectId(String(projectId)),
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error(`${LOG_PREFIX} Failed to write log`, e);
  }
}

function interpolateText(text, variables) {
  if (!text || !variables) return text;
  return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (_, key) =>
    variables[key] !== undefined ? String(variables[key]) : _
  );
}

async function sendWhatsAppMessage(db, job, contact, agent) {
  try {
    const {
      accessToken,
      phoneNumberId,
      templateName,
      language = 'en_US',
      components,
      headerMediaFile
    } = job;

    const finalComponents = JSON.parse(JSON.stringify(components || []));
    const headerComponent = finalComponents.find(c => c.type === 'header');

    if (
      headerMediaFile &&
      headerMediaFile.buffer?.data &&
      headerComponent?.parameters?.[0]
    ) {
      const parameter = headerComponent.parameters[0];
      const mediaType = parameter.type;

      if (!parameter[mediaType]?.id) {
        const buffer = Buffer.from(headerMediaFile.buffer.data);
        const form = new FormData();

        form.append('file', buffer, {
          filename: headerMediaFile.name,
          contentType: headerMediaFile.type,
        });
        form.append('messaging_product', 'whatsapp');

        const { statusCode, body } = await undici.request(
          `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`,
          {
            method: 'POST',
            dispatcher: agent,
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${accessToken}`,
            },
            body: form,
          }
        );

        const uploadResponse = await body.json();

        if (statusCode >= 400 || !uploadResponse?.id) {
          throw new Error('Media upload failed');
        }

        parameter[mediaType] = { id: uploadResponse.id };
      }
    }

    for (const component of finalComponents) {
      for (const param of component.parameters || []) {
        if (param.type === 'text') {
          param.text = interpolateText(param.text, contact.variables);
        }
      }
    }

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
      {
        method: 'POST',
        dispatcher: agent,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const response = await body.json();

    if (statusCode >= 400 || !response?.messages?.[0]?.id) {
      throw new Error('Message send failed');
    }

    return { success: true, messageId: response.messages[0].id };

  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

async function startBroadcastWorker(workerId) {
  const { db } = await connectToDatabase();
  const PQueue = (await import('p-queue')).default;

  const agent = new undici.Agent({
    connections: 200,
    pipelining: 10,
  });

  console.log(`${LOG_PREFIX} Worker ${workerId} started`);

  setInterval(async () => {
    let job;

    try {
      job = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'PENDING_PROCESSING' },
        { $set: { status: 'PROCESSING', workerId, startedAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!job) return;

      const { _id: broadcastId, projectId, messagesPerSecond = 80 } = job;

      await addBroadcastLog(db, broadcastId, projectId, 'INFO', 'Broadcast started');

      const queue = new PQueue({
        intervalCap: messagesPerSecond,
        interval: 1000,
        concurrency: messagesPerSecond,
      });

      const cursor = db.collection('broadcast_contacts')
        .find({ broadcastId, status: 'PENDING' })
        .batchSize(500);

      for await (const contact of cursor) {
        queue.add(async () => {
          const result = await sendWhatsAppMessage(db, job, contact, agent);

          await db.collection('broadcast_contacts').updateOne(
            { _id: contact._id },
            result.success
              ? { $set: { status: 'SENT', sentAt: new Date(), messageId: result.messageId } }
              : { $set: { status: 'FAILED', error: result.error } }
          );
        });
      }

      await queue.onIdle();

      const successCount = await db.collection('broadcast_contacts')
        .countDocuments({ broadcastId, status: 'SENT' });

      const failedCount = await db.collection('broadcast_contacts')
        .countDocuments({ broadcastId, status: 'FAILED' });

      await db.collection('broadcasts').updateOne(
        { _id: broadcastId },
        {
          $set: {
            status: 'COMPLETED',
            completedAt: new Date(),
            successCount,
            errorCount: failedCount,
          },
        }
      );

      await addBroadcastLog(
        db,
        broadcastId,
        projectId,
        'INFO',
        `Completed. Sent: ${successCount}, Failed: ${failedCount}`
      );

    } catch (err) {
      console.error(`${LOG_PREFIX} CRITICAL ERROR`, err);
      if (job?._id) {
        await db.collection('broadcasts').updateOne(
          { _id: job._id },
          { $set: { status: 'FAILED_PROCESSING', error: getErrorMessage(err) } }
        );
      }
    }
  }, 5000);
}

function main() {
  const workerId =
    process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;

  console.log(`${LOG_PREFIX} Starting worker ${workerId}`);

  startBroadcastWorker(workerId).catch(err => {
    console.error(`${LOG_PREFIX} Startup failure`, err);
    process.exit(1);
  });
}

main();
