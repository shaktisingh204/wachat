
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { connectToDatabase } = require(path.resolve(process.cwd(), 'src/lib/mongodb.worker.js'));
const { getErrorMessage } = require(path.resolve(process.cwd(), 'src/lib/utils.worker.js'));

const undici = require('undici');
const { ObjectId } = require('mongodb');

let pThrottle;
const importPThrottle = async () => {
  if (!pThrottle) {
    pThrottle = (await import('p-throttle')).default;
  }
  return pThrottle;
};

const API_VERSION = 'v22.0';
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

async function sendWhatsAppMessage(job, contact, agent) {
  try {
    const { accessToken, phoneNumberId, templateName, language = 'en_US', components } = job;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: contact.phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: components || [],
      }
    };
    
    // Replace variables in components
    if (payload.template.components) {
        payload.template.components.forEach(component => {
            if (component.parameters) {
                component.parameters.forEach(param => {
                    if (param.type === 'text') {
                        const varName = param.text.match(/{{(.*?)}}/);
                        if (varName && varName[1] && contact[varName[1]]) {
                            param.text = contact[varName[1]];
                        }
                    }
                });
            }
        });
    }


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
  const pThrottleLib = await importPThrottle();

  console.log(`${LOG_PREFIX} Worker ${workerId} started. Polling for jobs every 5 seconds.`);

  setInterval(async () => {
    try {
      const job = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'PENDING_PROCESSING' },
        { $set: { status: 'PROCESSING', workerId: workerId, startedAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!job) {
        return; // No job to process
      }
      
      const broadcastId = job._id;
      const projectId = job.projectId;

      await addBroadcastLog(db, broadcastId, projectId, "INFO", `Worker ${workerId} picked up job.`);

      const contacts = await db.collection('broadcast_contacts').find({ broadcastId: broadcastId, status: { $ne: 'SENT' } }).toArray();

      if (contacts.length === 0) {
        await db.collection('broadcasts').updateOne({ _id: broadcastId }, { $set: { status: 'Completed', completedAt: new Date() } });
        await addBroadcastLog(db, broadcastId, projectId, "INFO", `No contacts to process. Marking broadcast as complete.`);
        return;
      }
      
      const mps = Number(job.messagesPerSecond) || 80;
      const agent = new undici.Agent({ connections: 200, pipelining: 1 });

      const throttle = pThrottleLib({
        limit: mps,
        interval: 1000,
        strict: true
      });

      const throttledSend = throttle((contact) => sendWhatsAppMessage(job, contact, agent));

      const results = await Promise.all(contacts.map(async (contact) => {
        const r = await throttledSend(contact);
        return { contactId: contact._id, ...r };
      }));

      const bulkOps = [];
      let success = 0;
      let failed = 0;

      for (const r of results) {
        if (r.success) {
          success++;
          bulkOps.push({
            updateOne: {
              filter: { _id: new ObjectId(r.contactId) },
              update: { $set: { status: "SENT", sentAt: new Date(), messageId: r.messageId, error: null } }
            }
          });
        } else {
          failed++;
          bulkOps.push({
            updateOne: {
              filter: { _id: new ObjectId(r.contactId) },
              update: { $set: { status: "FAILED", error: r.error } }
            }
          });
        }
      }

      if (bulkOps.length > 0) {
        await db.collection("broadcast_contacts").bulkWrite(bulkOps, { ordered: false });
      }

      await addBroadcastLog(
        db, broadcastId, projectId, "INFO",
        `Worker ${workerId} finished processing. Sent: ${success} | Failed: ${failed}`
      );
      
      const finalUpdate = await db.collection('broadcasts').updateOne(
        { _id: broadcastId },
        {
          $inc: { successCount: success, errorCount: failed },
          $set: { status: 'Completed', completedAt: new Date() }
        }
      );

      if (finalUpdate.modifiedCount > 0) {
          await addBroadcastLog(db, broadcastId, projectId, "INFO", `Broadcast marked as Completed.`);
      }

    } catch (e) {
      console.error(`${LOG_PREFIX} Worker ${workerId} CRITICAL ERROR:`, getErrorMessage(e));
      // Optionally, find the job this worker was processing and mark it as FAILED
      // This is complex to do safely without more state management.
    }
  }, 5000); // Polls every 5 seconds
}

module.exports = { startBroadcastWorker };
