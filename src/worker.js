
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

const getErrorMessage = (error) => {
    // Axios-like structure from undici response
    if (error?.error && typeof error.error === 'object') {
        const apiError = error.error;
        let message = apiError.error_user_title
            ? `${apiError.error_user_title}: ${apiError.error_user_msg}`
            : apiError.message || JSON.stringify(apiError);
        if (apiError.code) message += ` (Code: ${apiError.code})`;
        if (apiError.fbtrace_id) message += ` (Trace: ${apiError.fbtrace_id})`;
        return message;
    }
    // Standard JS Error
    if (error instanceof Error) return error.message;
    // Other cases
    return String(error) || 'Unknown error';
};


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
  return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (_, key) => {
    const trimmedKey = key.trim();
    return variables[trimmedKey] !== undefined ? String(variables[trimmedKey]) : _;
  });
}

/* ================= META SEND ================= */

async function sendWhatsAppMessage(db, job, contact, agent) {
  try {
    const {
      accessToken,
      phoneNumberId,
      templateName,
      language = 'en_US',
      components: originalComponents,
      headerImageUrl,
      headerMediaFile,
    } = job;

    const payloadComponents = [];
    const headerDef = originalComponents.find(c => c.type === 'HEADER');
    
    if (headerDef) {
        let parameter;
        const format = headerDef.format?.toLowerCase();
        
        if (format && ['image', 'video', 'document'].includes(format)) {
            let mediaId;
            if (headerMediaFile?.buffer?.data) {
                const buffer = Buffer.from(headerMediaFile.buffer.data);
                const form = new FormData();
                form.append('file', buffer, { filename: headerMediaFile.name, contentType: headerMediaFile.type });
                form.append('messaging_product', 'whatsapp');
                const { statusCode, body } = await undici.request(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`, { method: 'POST', dispatcher: agent, headers: { ...form.getHeaders(), Authorization: `Bearer ${accessToken}` }, body: form });
                const uploadResponse = await body.json();
                if (statusCode >= 400 || !uploadResponse?.id) throw new Error(`Media upload failed: ${JSON.stringify(uploadResponse?.error || 'Unknown upload error')}`);
                mediaId = uploadResponse.id;
            }
            if (mediaId) {
                parameter = { type: format, [format]: { id: mediaId } };
            } else if (headerImageUrl) {
                parameter = { type: format, [format]: { link: headerImageUrl } };
            }
        } else if (format === 'text' && headerDef.text) {
             const headerVars = (headerDef.text.match(/{{\s*(\d+)\s*}}/g) || []).map(v => parseInt(v.replace(/{{\s*|\s*}}/g, '')));
             if (headerVars.length > 0) {
                 const textValue = interpolateText(headerDef.text, contact.variables);
                 parameter = { type: 'text', text: textValue };
             }
        }
        if (parameter) {
            payloadComponents.push({ type: 'header', parameters: [parameter] });
        }
    }

    const bodyDef = originalComponents.find(c => c.type === 'BODY');
    if (bodyDef?.text) {
        const bodyVars = (bodyDef.text.match(/{{\s*(\d+)\s*}}/g) || []).map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))).sort((a, b) => a - b);
        if (bodyVars.length > 0) {
            const parameters = bodyVars.map(varNum => {
                const varKey = `variable${varNum}`;
                const value = contact.variables?.[varKey] || '';
                return { type: 'text', text: value };
            });
            payloadComponents.push({ type: 'body', parameters });
        }
    }

    const buttonsDef = originalComponents.find(c => c.type === 'BUTTONS');
    if (buttonsDef?.buttons) {
        buttonsDef.buttons.forEach((button, index) => {
            if (button.type === 'URL' && button.url?.includes('{{1}}')) {
                 const varKey = `button_variable_${index}`;
                 const buttonVarValue = contact.variables?.[varKey] || '';
                 if (buttonVarValue) {
                      payloadComponents.push({ type: 'button', sub_type: 'url', index: String(index), parameters: [{ type: 'text', text: buttonVarValue }]});
                 }
            }
        });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: contact.phone,
      type: 'template',
      template: { name: templateName, language: { code: language }, ...(payloadComponents.length > 0 && { components: payloadComponents }) }
    };

    const res = await undici.request(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, { method: 'POST', dispatcher: agent, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(payload) });
    const resBodyText = await res.body.text();
    let resData;
    try {
        resData = JSON.parse(resBodyText);
    } catch (e) {
        throw new Error(`Meta API returned non-JSON response (Status: ${res.statusCode}): ${resBodyText.substring(0, 500)}`);
    }

    if (res.statusCode >= 400 || !resData?.messages?.[0]?.id) {
        throw new Error(getErrorMessage(resData));
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

  const agent = new undici.Agent({ connections: 200, pipelining: 10 });

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

      const { _id: broadcastId, projectId, messagesPerSecond = 80 } = job;

      await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Worker ${workerId} picked up job.`);

      const queue = new PQueue({
        intervalCap: messagesPerSecond,
        interval: 1000,
        concurrency: messagesPerSecond,
      });

      const cursor = db.collection('broadcast_contacts')
        .find({ broadcastId, status: 'PENDING' })
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
        .countDocuments({ broadcastId, status: 'SENT' });

      const failed = await db.collection('broadcast_contacts')
        .countDocuments({ broadcastId, status: 'FAILED' });

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
