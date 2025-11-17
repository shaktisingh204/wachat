'use strict';

require('dotenv').config();
const { connectToDatabase } = require('../lib/mongodb.ts');
const { getErrorMessage } = require('../lib/utils.ts');
const { Kafka } = require('kafkajs');
const undici = require('undici');
const { ObjectId } = require('mongodb');

let pThrottle;
const importPThrottle = async () => {
  if (!pThrottle) {
    pThrottle = (await import('p-throttle')).default;
  }
  return pThrottle;
};

if (!process.env.KAFKA_BROKERS) {
  console.error('[WORKER] FATAL: KAFKA_BROKERS environment variable is not set.');
  process.exit(1);
}

const API_VERSION = 'v23.0';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(',');
const LOG_PREFIX = '[WORKER]';

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
    console.error(`${LOG_PREFIX} Failed to write log for job ${String(broadcastId)}:`, e);
  }
}

// Send a single WhatsApp template message using undici and provided agent
async function sendWhatsAppMessage(job, contact, agent) {
  try {
    const {
      accessToken, phoneNumberId, templateName, language = 'en_US',
      components, headerImageUrl, headerMediaId, variableMappings
    } = job;

    // Build components similar to your previous implementation (kept minimal for speed)
    const getVars = (text) => text ? [...new Set((text.match(/{{\s*(\d+)\s*}}/g) || []).map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
    const interpolate = (text, variables) => {
      if (!text) return '';
      return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (m, key) =>
        variables && variables[key] !== undefined ? String(variables[key]) : m
      );
    };

    const payloadComponents = [];
    const headerComponent = components?.find(c => c.type === 'HEADER');
    if (headerComponent) {
      let parameter;
      const format = headerComponent.format?.toLowerCase();
      if (format && (format === 'image' || format === 'video' || format === 'document')) {
        if (headerMediaId) parameter = { type: format, [format]: { id: headerMediaId } };
        else if (headerImageUrl) parameter = { type: format, [format]: { link: headerImageUrl } };
      } else if (format === 'text' && headerComponent.text) {
        if (getVars(headerComponent.text).length > 0) {
          parameter = { type: 'text', text: interpolate(headerComponent.text, contact.variables || {}) };
        }
      }
      if (parameter) payloadComponents.push({ type: 'header', parameters: [parameter] });
    }

    const bodyComponent = components?.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const bodyVars = getVars(bodyComponent.text);
      if (bodyVars.length > 0) {
        const parameters = bodyVars
          .sort((a, b) => a - b)
          .map(varNum => {
            const mapping = variableMappings?.find(m => m.var === String(varNum));
            const varKey = mapping ? mapping.value : `variable${varNum}`;
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
        language: { code: language },
        ...(payloadComponents.length > 0 && { components: payloadComponents })
      }
    };

    const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
    const res = await undici.request(url, {
      method: 'POST',
      dispatcher: agent,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData),
      throwOnError: false,
      bodyTimeout: 20000,
    });

    const body = await res.body.json().catch(() => null);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const messageId = body?.messages?.[0]?.id || null;
      return { success: true, messageId };
    } else {
      // Return error details (stringified) so caller can log and store it
      const errDetail = body?.error ? JSON.stringify(body.error) : JSON.stringify(body);
      return { success: false, error: `Meta API ${res.statusCode}: ${errDetail}` };
    }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

async function startBroadcastWorker(workerId, kafkaTopic) {
  const pThrottleDefault = await importPThrottle();
  const GROUP_ID = `sabnode-broadcaster-group-v5`;

  console.log(`${LOG_PREFIX} ${workerId} | Starting | Topic: ${kafkaTopic} | Group: ${GROUP_ID}`);

  const { db } = await connectToDatabase();

  const kafka = new Kafka({
    clientId: `whatsapp-worker-${workerId}`,
    brokers: KAFKA_BROKERS
  });

  const consumer = kafka.consumer({
    groupId: GROUP_ID,
    sessionTimeout: 60000,
    rebalanceTimeout: 90000,
    heartbeatInterval: 3000,
    allowAutoTopicCreation: false,
  });

  const run = async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: kafkaTopic, fromBeginning: false });
    console.log(`${LOG_PREFIX} ${workerId} | Connected to Kafka and subscribed to '${kafkaTopic}'.`);

    await consumer.run({
      eachMessage: async ({ message, heartbeat }) => {
        let parsedMessage;
        try {
          if (!message.value) return;
          parsedMessage = JSON.parse(message.value.toString());
        } catch (e) {
          console.error(`${LOG_PREFIX} ${workerId} | Failed to JSON.parse message:`, e);
          return;
        }

        const { jobDetails, contacts } = parsedMessage;
        if (!jobDetails?._id || !Array.isArray(contacts) || contacts.length === 0) {
          console.error(`${LOG_PREFIX} ${workerId} | Invalid message payload received, skipping.`);
          return;
        }

        const broadcastId = new ObjectId(String(jobDetails._id));
        const projectId = new ObjectId(String(jobDetails.projectId));

        try {
          // <<< THIS LINE MUST REMAIN EXACTLY AS-IS >>>
          const mps = Number(jobDetails.messagesPerSecond) || 80;
          // ----------------------------------------------------------------
          // Create an undici agent sized to the requested mps (one agent per job)
          // Note: agent sizing is a heuristic to provision sockets; you can tune.
          // ----------------------------------------------------------------
          const desiredConnections = Math.max(50, Math.min(20000, Math.round(mps * 0.6)));
          const agent = new undici.Agent({
            connections: desiredConnections,
            pipelining: Math.min(10, Math.max(1, Math.floor(desiredConnections / 1000))),
            keepAliveTimeout: 10000,
            keepAliveMaxTimeout: 15000,
          });

          await addBroadcastLog(db, broadcastId, projectId, 'INFO',
            `${LOG_PREFIX} ${workerId} | Started processing batch of ${contacts.length} contacts. mps: ${mps}, agent connections: ${desiredConnections}`);

          // p-throttle with exact mps (no cap, no clamp)
          const throttle = pThrottleDefault({
            limit: mps,
            interval: 1000,
            strict: false, // burst mode — improves real-world throughput
          });

          const throttledSend = throttle(async (contact) => {
            // sendWhatsAppMessage returns { success, messageId } or { success: false, error }
            return await sendWhatsAppMessage(jobDetails, contact, agent);
          });

          // Prepare promises: call throttledSend for each contact; heartbeat outside
          const promises = [];
          for (const contact of contacts) {
            try {
              // call heartbeat frequently but non-blocking
              try { heartbeat(); } catch (e) { /* ignore heartbeat errors */ }
              promises.push(
                throttledSend(contact).then(result => ({ contactId: contact._id, ...result }))
              );
            } catch (e) {
              // If scheduling failed for a contact we still push a failed result
              promises.push(Promise.resolve({ contactId: contact._id, success: false, error: getErrorMessage(e) }));
            }
          }

          // Await all results but don't fail fast; we want to collect everything
          const settled = await Promise.allSettled(promises);
          const results = settled.map(s => s.status === 'fulfilled' ? s.value : { success: false, error: (s.reason && s.reason.message) || String(s.reason) });

          // Prepare bulk operations for contacts
          const bulkOps = [];
          let batchSuccessCount = 0;
          let batchErrorCount = 0;

          for (const r of results) {
            if (!r || !r.contactId) { batchErrorCount++; continue; }
            if (r.success) {
              batchSuccessCount++;
              bulkOps.push({
                updateOne: {
                  filter: { _id: new ObjectId(String(r.contactId)) },
                  update: { $set: { status: 'SENT', sentAt: new Date(), messageId: r.messageId, error: null } }
                }
              });
            } else {
              batchErrorCount++;
              bulkOps.push({
                updateOne: {
                  filter: { _id: new ObjectId(String(r.contactId)) },
                  update: { $set: { status: 'FAILED', error: r.error || 'unknown' } }
                }
              });
            }
          }

          if (bulkOps.length > 0) {
            // Bulk write in chunks to avoid too-large operations
            const BATCH_WRITE_SIZE = 1000;
            for (let i = 0; i < bulkOps.length; i += BATCH_WRITE_SIZE) {
              const chunk = bulkOps.slice(i, i + BATCH_WRITE_SIZE);
              try {
                await db.collection('broadcast_contacts').bulkWrite(chunk, { ordered: false });
              } catch (e) {
                console.error(`${LOG_PREFIX} ${workerId} | bulkWrite chunk error:`, e);
              }
            }
          }

          // Update broadcast counters
          const updatedJob = await db.collection('broadcasts').findOneAndUpdate(
            { _id: broadcastId },
            { $inc: { successCount: batchSuccessCount, errorCount: batchErrorCount } },
            { returnDocument: 'after' }
          );

          await addBroadcastLog(db, broadcastId, projectId, 'INFO', `${LOG_PREFIX} ${workerId} | Finished batch. Success: ${batchSuccessCount}, Failed: ${batchErrorCount}.`);

          // Mark Completed if all contacts processed (safe check)
          if (updatedJob.value && (updatedJob.value.successCount + updatedJob.value.errorCount) >= (updatedJob.value.contactCount || 0)) {
            await db.collection('broadcasts').updateOne(
              { _id: broadcastId, status: 'PROCESSING' },
              { $set: { status: 'Completed', completedAt: new Date() } }
            );
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', `${LOG_PREFIX} All contacts processed. Job marked as Completed.`);
          }

          // Destroy agent sockets for this job to free resources (optional)
          try {
            agent.close();
          } catch (e) {
            // ignore
          }

        } catch (err) {
          const errorMsg = getErrorMessage(err);
          console.error(`${LOG_PREFIX} ${workerId} | CRITICAL ERROR processing Kafka message:`, errorMsg);
          try {
            await addBroadcastLog(db, new ObjectId(String(jobDetails._id)), new ObjectId(String(jobDetails.projectId)), 'ERROR', `${LOG_PREFIX} ${workerId} | Critical error: ${errorMsg}`);
          } catch (e) { /* ignore logging errors */ }
        }
      }
    });
  };

  run().catch(async (err) => {
    console.error(`${LOG_PREFIX} ${workerId} | Consumer run failed, will attempt restart:`, err);
    try { await consumer.disconnect(); } catch (e) { console.error('Failed to disconnect consumer on error:', e); }
    setTimeout(() => run(), 5000);
  });
}

module.exports = { startBroadcastWorker };
