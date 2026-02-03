
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
  throw new Error('Missing MongoDB env variables');
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return { db: cachedDb };

  const client = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();

  cachedClient = client;
  cachedDb = client.db(MONGODB_DB);

  return { db: cachedDb };
}

// --- UTILITIES ---
const API_VERSION = 'v23.0';
const LOG_PREFIX = '[BROADCAST-WORKER]';

const getErrorMessage = (err) =>
  err instanceof Error ? err.message : String(err);

async function addBroadcastLog(db, broadcastId, projectId, level, message) {
  try {
    await db.collection('broadcast_logs').insertOne({
      broadcastId: new ObjectId(String(broadcastId)),
      projectId: new ObjectId(String(projectId)),
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
      headerMediaFile,
    } = job;

    const finalComponents = (components || [])
      .map(c => {
        // Fix: Map generic 'BUTTONS' type to Meta's expected 'BUTTON' if applicable,
        // or ensure strict type compliance.
        // Actually, Meta expects 'button' (lowercase) usually for components in /messages
        // but let's check the error: "must be one of {..., BUTTON, ...}".
        // It seems the API expects uppercase 'BUTTON'.
        if (c.type === 'BUTTONS') return { ...c, type: 'BUTTON' };
        return c;
      })
      .filter(c => {
        // Meta API only accepts specific component types in the `components` param for /messages.
        const allowedTypes = ['HEADER', 'BODY', 'FOOTER', 'BUTTON'];
        return allowedTypes.includes(c.type?.toUpperCase());
      });

    for (const c of finalComponents) {
      // Sanitize: Remove keys that Meta API does not accept
      delete c.format;
      delete c.text;
      delete c.example;
      delete c.buttons;

      // Ensure index is strings for buttons if needed, or integers?
      // Meta API typically needs: { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [...] }

      for (const p of c.parameters || []) {
        if (p.type === 'text') {
          p.text = interpolateText(p.text, contact.variables);
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

    const res = await undici.request(
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

    const resBodyText = await res.body.text();
    let resData;
    try {
      resData = JSON.parse(resBodyText);
    } catch (e) {
      throw new Error(`Meta API returned non-JSON response (Status: ${res.statusCode}): ${resBodyText.substring(0, 500)}`);
    }

    if (res.statusCode >= 400 || !resData?.messages?.[0]?.id) {
      const apiError = resData?.error;
      if (apiError && typeof apiError === 'object') {
        let message = apiError.error_user_title
          ? `${apiError.error_user_title}: ${apiError.error_user_msg}`
          : apiError.message || JSON.stringify(apiError);
        if (apiError.code) message += ` (Code: ${apiError.code})`;
        if (apiError.fbtrace_id) message += ` (Trace: ${apiError.fbtrace_id})`;
        throw new Error(message);
      }
      throw new Error(`Meta API error (Status: ${res.statusCode}): ${JSON.stringify(resData)}`);
    }

    return { success: true, messageId: resData.messages[0].id, sentPayload: payload.template };

  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/* ================= WORKER ================= */

async function startBroadcastWorker(workerId) {
  const { db } = await connectToDatabase();
  const PQueue = (await import('p-queue')).default;

  const agent = new undici.Agent({
    connections: 200,
    pipelining: 10,
  });

  console.log(`${LOG_PREFIX} Worker ${workerId} started`);

  let busy = false;

  setInterval(async () => {
    if (busy) return;
    busy = true;

    let job = null;

    try {
      const res = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'PENDING_PROCESSING' },
        { $set: { status: 'PROCESSING', workerId, startedAt: new Date() } },
        { returnDocument: 'after' }
      );

      job = res;
      if (!job) {
        busy = false;
        return;
      }

      const { _id, projectId, messagesPerSecond = 80 } = job;

      await addBroadcastLog(db, _id, projectId, 'INFO', `Worker ${workerId} picked up job.`);

      const queue = new PQueue({
        intervalCap: messagesPerSecond, // MPS
        interval: 1000,
        concurrency: messagesPerSecond,
      });

      const cursor = db.collection('broadcast_contacts')
        .find({ broadcastId: _id, status: 'PENDING' })
        .batchSize(500);

      const tasks = [];
      for await (const contact of cursor) {
        tasks.push(queue.add(async () => {
          const result = await sendWhatsAppMessage(db, job, contact, agent);

          if (result.success) {
            await db.collection("broadcast_contacts").updateOne({ _id: contact._id }, { $set: { status: "SENT", sentAt: new Date(), messageId: result.messageId, error: null } });

            const now = new Date();
            const { value: contactDoc } = await db.collection('contacts').findOneAndUpdate(
              { projectId: new ObjectId(job.projectId), waId: contact.phone },
              {
                $setOnInsert: { projectId: new ObjectId(job.projectId), phoneNumberId: job.phoneNumberId, name: contact.name, waId: contact.phone, createdAt: now },
                $set: { status: 'open', lastMessage: `[Template]: ${job.templateName}`.substring(0, 50), lastMessageTimestamp: now }
              },
              { upsert: true, returnDocument: 'after' }
            );

            if (contactDoc) {
              await db.collection('outgoing_messages').insertOne({
                direction: 'out', contactId: contactDoc._id, projectId: new ObjectId(job.projectId), wamid: result.messageId,
                messageTimestamp: now, type: 'template', content: { template: result.sentPayload }, status: 'sent',
                statusTimestamps: { sent: now }, createdAt: now,
              });
            }
          } else {
            await db.collection("broadcast_contacts").updateOne({ _id: contact._id }, { $set: { status: "FAILED", error: result.error } });
          }
        }));
      }

      await Promise.all(tasks);

      const success = await db.collection('broadcast_contacts')
        .countDocuments({ broadcastId: _id, status: 'SENT' });

      const failed = await db.collection('broadcast_contacts')
        .countDocuments({ broadcastId: _id, status: 'FAILED' });

      await addBroadcastLog(
        db,
        _id,
        projectId,
        'INFO',
        `Completed: ${success} sent, ${failed} failed`
      );

      await db.collection('broadcasts').updateOne(
        { _id },
        {
          $set: {
            status: 'Completed',
            completedAt: new Date(),
            successCount: success,
            errorCount: failed,
          },
        }
      );

    } catch (e) {
      console.error(`${LOG_PREFIX} CRITICAL`, e);
      if (job?._id) {
        await db.collection('broadcasts').updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'FAILED_PROCESSING',
              error: getErrorMessage(e)
            }
          }
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
