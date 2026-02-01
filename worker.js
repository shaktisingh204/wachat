'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { MongoClient, ObjectId } = require('mongodb');
const undici = require('undici');
const FormData = require('form-data');

/* ================= DATABASE ================= */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_URI || !MONGODB_DB) {
  throw new Error('Missing MongoDB env variables');
}

let cachedClient, cachedDb;

async function connectToDatabase() {
  if (cachedDb) return { db: cachedDb };

  const client = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();

  cachedClient = client;
  cachedDb = client.db(MONGODB_DB);

  return { db: cachedDb };
}

/* ================= HELPERS ================= */

const API_VERSION = 'v23.0';
const LOG_PREFIX = '[BROADCAST-WORKER]';

const getErrorMessage = (err) =>
  err instanceof Error ? err.message : String(err);

async function addBroadcastLog(db, broadcastId, projectId, level, message) {
  try {
    await db.collection('broadcast_logs').insertOne({
      broadcastId: new ObjectId(broadcastId),
      projectId: new ObjectId(projectId),
      level,
      message,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error(`${LOG_PREFIX} Log write failed`, e);
  }
}

function interpolateText(text, vars) {
  if (!text || !vars) return text;
  return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : _
  );
}

/* ================= META SEND ================= */

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

    const finalComponents = structuredClone(components || []);
    const header = finalComponents.find(c => c.type === 'header');

    if (headerMediaFile?.buffer?.data && header?.parameters?.[0]) {
      const param = header.parameters[0];
      if (!param[param.type]?.id) {
        const form = new FormData();
        form.append(
          'file',
          Buffer.from(headerMediaFile.buffer.data),
          headerMediaFile.name
        );
        form.append('messaging_product', 'whatsapp');

        const upload = await undici.request(
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

        const data = await upload.body.json();
        if (!data?.id) throw new Error('Media upload failed');

        param[param.type] = { id: data.id };
      }
    }

    for (const c of finalComponents) {
      for (const p of c.parameters || []) {
        if (p.type === 'text') {
          p.text = interpolateText(p.text, contact.variables);
        }
      }
    }

    const res = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        dispatcher: agent,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: contact.phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components: finalComponents,
          },
        }),
      }
    );

    const body = await res.body.json();
    if (!body?.messages?.[0]?.id) throw new Error('Message send failed');

    return { success: true, messageId: body.messages[0].id };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ================= WORKER ================= */

async function startBroadcastWorker(workerId) {
  const { db } = await connectToDatabase();
  const PQueue = (await import('p-queue')).default;

  const agent = new undici.Agent({ connections: 200, pipelining: 10 });

  console.log(`${LOG_PREFIX} Worker ${workerId} started`);

  let busy = false;

  setInterval(async () => {
    if (busy) return;
    busy = true;

    let job;

    try {
      const res = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'PENDING_PROCESSING' },
        { $set: { status: 'PROCESSING', workerId, startedAt: new Date() } },
        { returnDocument: 'after' }
      );

      job = res.value;
      if (!job) return;

      const { _id, projectId, messagesPerSecond = 80 } = job;

      await addBroadcastLog(db, _id, projectId, 'INFO', 'Broadcast started');

      const queue = new PQueue({
        intervalCap: messagesPerSecond,
        interval: 1000,
        concurrency: messagesPerSecond,
      });

      const cursor = db.collection('broadcast_contacts')
        .find({ broadcastId: _id, status: 'PENDING' })
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

      const success = await db.collection('broadcast_contacts')
        .countDocuments({ broadcastId: _id, status: 'SENT' });

      const failed = await db.collection('broadcast_contacts')
        .countDocuments({ broadcastId: _id, status: 'FAILED' });

      await db.collection('broadcasts').updateOne(
        { _id },
        {
          $set: {
            status: 'COMPLETED',
            completedAt: new Date(),
            successCount: success,
            errorCount: failed,
          },
        }
      );

      await addBroadcastLog(
        db,
        _id,
        projectId,
        'INFO',
        `Completed: ${success} sent, ${failed} failed`
      );

    } catch (e) {
      console.error(`${LOG_PREFIX} CRITICAL`, e);
      if (job?._id) {
        await db.collection('broadcasts').updateOne(
          { _id: job._id },
          { $set: { status: 'FAILED_PROCESSING', error: getErrorMessage(e) } }
        );
      }
    } finally {
      busy = false;
    }
  }, 5000);
}

/* ================= BOOT ================= */

function main() {
  const workerId =
    process.env.PM2_INSTANCE_ID !== undefined
      ? `pm2-${process.env.PM2_INSTANCE_ID}`
      : `pid-${process.pid}`;

  console.log(`${LOG_PREFIX} Booting ${workerId}`);
  startBroadcastWorker(workerId).catch(err => {
    console.error(`${LOG_PREFIX} Startup failure`, err);
    process.exit(1);
  });
}

main();
