'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { connectToDatabase } = require('./src/lib/mongodb.worker.js');
const { getErrorMessage } = require('./src/lib/utils.worker.js');
const undici = require('undici');
const { ObjectId } = require('mongodb');

let pThrottle;
const BATCH_SIZE = 1000;
const API_VERSION = 'v23.0';
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
        return; 
      }
      
      const { _id: broadcastId, projectId, messagesPerSecond } = job;
      await addBroadcastLog(db, broadcastId, projectId, "INFO", `Worker ${workerId} picked up job.`);

      const throttle = pThrottle({
        limit: messagesPerSecond || 80,
        interval: 1000
      });

      const throttledSend = throttle(async (contact) => {
          const result = await sendWhatsAppMessage(job, contact, agent);
          if (result.success) {
            await db.collection("broadcast_contacts").updateOne({ _id: contact._id }, { $set: { status: "SENT", sentAt: new Date(), messageId: result.messageId, error: null } });
            return { success: true };
          } else {
            await db.collection("broadcast_contacts").updateOne({ _id: contact._id }, { $set: { status: "FAILED", error: result.error } });
            return { success: false };
          }
      });

      const cursor = db.collection('broadcast_contacts').find({ broadcastId: broadcastId, status: { $ne: 'SENT' } });
      const promises = [];
      
      for await (const contact of cursor) {
          promises.push(throttledSend(contact));
      }
      
      await Promise.all(promises);

      const successCount = await db.collection('broadcast_contacts').countDocuments({ broadcastId, status: 'SENT' });
      const failedCount = await db.collection('broadcast_contacts').countDocuments({ broadcastId, status: 'FAILED' });

      await addBroadcastLog(db, broadcastId, projectId, "INFO", `Finished processing. Total Sent: ${successCount} | Total Failed: ${failedCount}`);
      
      await db.collection('broadcasts').updateOne(
        { _id: broadcastId },
        {
          $set: { 
            status: 'Completed', 
            completedAt: new Date(), 
            successCount, 
            errorCount: failedCount 
          }
        }
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
