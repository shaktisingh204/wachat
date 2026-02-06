
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
  return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (_, k) => {
    const val = vars[k];
    // FALBACK FIX: If variable is empty, return zero-width space to prevent (#100) error
    return (val !== undefined && val !== null && String(val).trim() !== '') ? String(val) : '\u200B';
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
      components,
      headerMediaId, // Injected by worker loop
      headerMediaType, // Injected by worker loop
      broadcastType,
      flowMetaId,
      flowConfig
    } = job;

    let payload;

    if (broadcastType === 'flow') {
      payload = {
        messaging_product: 'whatsapp',
        to: contact.phone,
        recipient_type: 'individual',
        type: 'interactive',
        interactive: {
          type: 'flow',
          header: flowConfig?.header ? { type: 'text', text: flowConfig.header } : undefined,
          body: { text: flowConfig?.body || 'Open Flow' },
          footer: flowConfig?.footer ? { text: flowConfig.footer } : undefined,
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: contact._id.toString(),
              flow_id: flowMetaId,
              flow_cta: flowConfig?.cta || 'Open App',
              flow_action: 'navigate',
              flow_action_payload: {
                screen: 'INIT'
              }
            }
          }
        }
      };
    } else {
      // Template Logic
      let finalComponents = (components || [])
        .map(c => {
          if (c.type === 'BUTTONS') return { ...c, type: 'BUTTON' };
          return c;
        })
        .filter(c => {
          const allowedTypes = ['HEADER', 'BODY', 'FOOTER', 'BUTTON'];
          return allowedTypes.includes(c.type?.toUpperCase());
        });

      // Inject Media Header if available
      if (headerMediaId && headerMediaType) {
        // Remove existing header component if any (to replace with media one)
        // actually standard templates usually define the header type. 
        // We need to Find the header component and inject the parameter.
        const headerCompIndex = finalComponents.findIndex(c => c.type === 'HEADER');

        const mediaParam = {
          type: headerMediaType.toLowerCase(), // image, video, document
          [headerMediaType.toLowerCase()]: { id: headerMediaId }
        };

        if (headerCompIndex > -1) {
          // Modify existing header definition to include the parameter
          // The template definition might say format: IMAGE, we just need to provide parameters.
          finalComponents[headerCompIndex] = {
            type: 'header',
            parameters: [mediaParam]
          };
        } else {
          // If strictly missing, force add it (though usually it should be in components list)
          finalComponents.unshift({
            type: 'header',
            parameters: [mediaParam]
          });
        }
      }

      for (const c of finalComponents) {
        // Cleanup template keys that aren't API valid
        delete c.format;
        delete c.text;
        delete c.example;
        delete c.buttons;

        // Interpolate only if parameters exist (for text params)
        // Media params are already set above if media header exists.
        for (const p of c.parameters || []) {
          if (p.type === 'text') {
            p.text = interpolateText(p.text, contact.variables);
          }
        }
      }

      payload = {
        messaging_product: 'whatsapp',
        to: contact.phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          components: finalComponents,
        },
      };
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

    return { success: true, messageId: resData.messages[0].id, sentPayload: payload.template || payload.interactive };

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

      // --- MEDIA UPLOAD LOGIC ---
      if (job.headerMediaFile && !job.headerMediaId) {
        try {
          await addBroadcastLog(db, _id, projectId, 'INFO', `Uploading media header to Meta...`);
          const { buffer, name, type } = job.headerMediaFile;

          // Undici FormData for file upload
          const form = new FormData();
          form.append('messaging_product', 'whatsapp');
          form.append('file', Buffer.from(buffer.buffer), { filename: name, contentType: type });

          // Need to use axios or undici for upload. Undici is tricky with FormData streams sometimes, 
          // but here we can try standard fetch-like behavior if environment supports it, or raw undici. 
          // Since we have FormData required at top, let's use it.

          // NOTE: We need to recreate Agent for this single request or reused? 
          // We can just use a one-off request.

          // Construct headers manually for undici or use getHeaders() from form-data package

          // Using basic node fetch/axios might be easier here but we want to stick to dependencies.
          // worker.js has 'undici' and 'form-data'.

          // Let's use undici.request with the form.
          // We need to read the stream from form-data.

          // ALTERNATIVE: Just use the form-data submit method? No, returns stream.

          // Let's assume standard form-data usage.
          // Actually, `worker.js` imports `FormData` from `form-data`.

          // IMPORTANT: We need to get the length for Content-Length header if possible, 
          // otherwise transfer-encoding: chunked. Undici handles this well usually.

          // We'll use a helper to do the upload to ensure it works. 
          // Since this is a critical section, I will impl simple upload logic using the form.submit style or buffer.

          const mediaUploadRes = await undici.request(`https://graph.facebook.com/${API_VERSION}/${job.phoneNumberId}/media`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${job.accessToken}`,
              ...form.getHeaders()
            },
            body: form.getBuffer() // form-data supports getBuffer()
          });

          const mediaBody = await mediaUploadRes.body.json();

          if (mediaBody.id) {
            job.headerMediaId = mediaBody.id;
            job.headerMediaType = type.startsWith('video') ? 'VIDEO' : type.startsWith('image') ? 'IMAGE' : 'DOCUMENT';

            // Update DB so we don't re-upload on crash/restart
            await db.collection('broadcasts').updateOne(
              { _id },
              { $set: { headerMediaId: job.headerMediaId, headerMediaType: job.headerMediaType, headerMediaUploadedAt: new Date() } }
            );

            await addBroadcastLog(db, _id, projectId, 'INFO', `Media uploaded successfully. ID: ${job.headerMediaId}`);
          } else {
            throw new Error(JSON.stringify(mediaBody));
          }

        } catch (uploadErr) {
          console.error(`${LOG_PREFIX} Media upload failed`, uploadErr);
          await addBroadcastLog(db, _id, projectId, 'ERROR', `Failed to upload media header: ${getErrorMessage(uploadErr)}`);
          // Fail the job immediately if media upload fails?
          // Yes, because all messages will fail without the header.
          await db.collection('broadcasts').updateOne({ _id }, { $set: { status: 'FAILED_PROCESSING', error: `Media Upload Failed: ${getErrorMessage(uploadErr)}` } });
          busy = false;
          return;
        }
      }

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
                $set: { status: 'open', lastMessage: (job.broadcastType === 'flow' ? `[Flow]: ${job.flowName || job.templateName}` : `[Template]: ${job.templateName}`).substring(0, 50), lastMessageTimestamp: now }
              },
              { upsert: true, returnDocument: 'after' }
            );

            if (contactDoc) {
              const isFlow = job.broadcastType === 'flow';
              await db.collection('outgoing_messages').insertOne({
                direction: 'out', contactId: contactDoc._id, projectId: new ObjectId(job.projectId), wamid: result.messageId,
                messageTimestamp: now, type: isFlow ? 'interactive' : 'template',
                content: isFlow ? { interactive: result.sentPayload } : { template: result.sentPayload },
                status: 'sent',
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
