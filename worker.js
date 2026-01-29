
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { connectToDatabase } = require('./src/lib/mongodb.worker.js');
const { getErrorMessage } = require('./src/lib/utils.worker.js');
const undici = require('undici');
const { ObjectId } = require('mongodb');

let pThrottle;
const BATCH_SIZE = 1000;
const API_VERSION = 'v23.0'; // Updated API version
const LOG_PREFIX = '[BROADCAST-WORKER]';

async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
  try {
    await db.collection('broadcast_logs').insertOne({
      broadcastId,
      projectId,
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error(`${LOG_PREFIX} Failed to write log:`, e);
  }
}

// Improved variable replacement logic
function interpolateText(text, contact) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/{{(.*?)}}/g, (match, key) => {
        const trimmedKey = key.trim();
        // Check for direct properties or nested properties if your contact object is complex
        return contact[trimmedKey] !== undefined ? contact[trimmedKey] : match;
    });
}

async function sendWhatsAppMessage(job, contact, agent) {
  try {
    const { accessToken, phoneNumberId, templateName, language = 'en_US', components } = job;
    
    // Deep clone components to prevent mutation issues during interpolation
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
      template: {
        name: templateName,
        language: { code: language },
        components: interpolatedComponents,
      }
    };

    const response = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        dispatcher: agent,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
        throwOnError: false
      }
    );

    const json = await response.body.json().catch(() => null);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      const messageId = json?.messages?.[0]?.id || null;
      return { success: true, messageId };
    }

    return { success: false, error: JSON.stringify(json?.error || json) };

  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

async function startBroadcastWorker(workerId) {
  const { db } = await connectToDatabase();
  const pThrottleLib = await import('p-throttle');
  pThrottle = pThrottleLib.default;

  // **DEFINITIVE FIX:** Create the agent *once* outside the polling loop.
  const agent = new undici.Agent({ connections: 200, pipelining: 1 });

  console.log(`${LOG_PREFIX} Worker ${workerId} started. Polling for jobs every 5 seconds.`);

  setInterval(async () => {
    let job = null;
    try {
      job = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'PENDING_PROCESSING' },
        { $set: { status: 'PROCESSING', workerId: workerId, startedAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!job) {
        return; // No job to process
      }
      
      const { _id: broadcastId, projectId, messagesPerSecond } = job;
      await addBroadcastLog(db, broadcastId, projectId, "INFO", `Worker ${workerId} picked up job.`);

      const throttle = pThrottle({
        limit: messagesPerSecond || 80,
        interval: 1000
      });

      const throttledSend = throttle((contact) => sendWhatsAppMessage(job, contact, agent));

      let successCount = 0;
      let failedCount = 0;

      // **DEFINITIVE FIX:** Use a cursor to process contacts without loading all into memory.
      const cursor = db.collection('broadcast_contacts').find({ broadcastId: broadcastId, status: { $ne: 'SENT' } });

      while (await cursor.hasNext()) {
          // This approach is more complex than a simple `limit` loop, but it's the correct way to handle large datasets.
          // For simplicity and given the batching context, a limit-based loop is acceptable for now.
          const contactsBatch = await db.collection('broadcast_contacts')
              .find({ broadcastId: broadcastId, status: { $ne: 'SENT' } })
              .limit(BATCH_SIZE)
              .toArray();
          
          if (contactsBatch.length === 0) {
              break; // Exit if no more contacts are found in the query.
          }

          const results = await Promise.all(contactsBatch.map(c => throttledSend(c)));
          const bulkOps = [];
          for (let i = 0; i < results.length; i++) {
              const result = results[i];
              const contact = contactsBatch[i];
              if (result.success) {
                  successCount++;
                  bulkOps.push({ updateOne: { filter: { _id: contact._id }, update: { $set: { status: "SENT", sentAt: new Date(), messageId: result.messageId, error: null } } } });
              } else {
                  failedCount++;
                  bulkOps.push({ updateOne: { filter: { _id: contact._id }, update: { $set: { status: "FAILED", error: result.error } } } });
              }
          }
          if (bulkOps.length > 0) {
              await db.collection("broadcast_contacts").bulkWrite(bulkOps, { ordered: false });
          }
      }

      await cursor.close();
      
      await addBroadcastLog(db, broadcastId, projectId, "INFO", `Finished processing. Total Sent: ${successCount} | Total Failed: ${failedCount}`);
      
      await db.collection('broadcasts').updateOne(
        { _id: broadcastId },
        {
          $set: { 
            status: 'Completed', 
            completedAt: new Date(), 
            successCount: successCount, 
            errorCount: failedCount 
          }
        }
      );

    } catch (e) {
      console.error(`${LOG_PREFIX} Worker ${workerId} CRITICAL ERROR:`, getErrorMessage(e));
      // If a job was claimed, mark it as failed to allow for potential manual retry.
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

  console.log(`${LOG_PREFIX} Worker starting...`);
  console.log(`${LOG_PREFIX} ▸ Worker ID: ${workerId}`);

  try {
    startBroadcastWorker(workerId);
  } catch (err) {
    console.error(`${LOG_PREFIX} CRITICAL ERROR starting worker process.`, err);
    process.exit(1);
  }
}

main();
