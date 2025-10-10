
const { connectToDatabase } = require('./mongodb');
const { getRedisClient } = require('./redis');
const axios = require('axios');
const { ObjectId } = require('mongodb');

const API_VERSION = 'v23.0';
const DB_WRITE_BATCH_SIZE = 100;

// --- Rate Limiting with Redis ---
const createTokenBucketRateLimiter = (redis) => {
  return async (projectId, rate) => {
    const bucketKey = `rate-limit-bucket:${projectId}`;
    const timestampKey = `rate-limit-timestamp:${projectId}`;

    const now = Date.now();
    const [tokensStr, lastRefillStr] = await redis
      .multi()
      .get(bucketKey)
      .get(timestampKey)
      .exec();

    const lastRefill = lastRefillStr ? parseInt(lastRefillStr, 10) : now;
    const elapsed = (now - lastRefill) / 1000;
    
    let tokens = tokensStr ? parseFloat(tokensStr) : rate;
    tokens = Math.min(rate, tokens + elapsed * rate);
    
    if (tokens >= 1) {
      const newTokens = tokens - 1;
      await redis.multi().set(bucketKey, newTokens).set(timestampKey, now).exec();
      return 0;
    } else {
      const delay = (1 - tokens) * (1000 / rate);
      return delay;
    }
  };
};

// --- Message Sending Logic ---
async function sendWhatsAppMessage(db, job, contact) {
    try {
        const { accessToken, phoneNumberId, templateName, language, components, headerImageUrl, headerMediaId, variableMappings } = job;
        
        const getVars = (text) => {
            if (!text) return [];
            const matches = text.match(/{{\s*(\d+)\s*}}/g);
            return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
        };

        const payloadComponents = [];
        const headerComponent = components.find(c => c.type === 'HEADER');
        if (headerComponent) {
            let parameter;
            const format = headerComponent.format?.toLowerCase();
            if (headerMediaId) parameter = { type: format, [format]: { id: headerMediaId } };
            else if (headerImageUrl) parameter = { type: format, [format]: { link: headerImageUrl } };
            if (parameter) payloadComponents.push({ type: 'header', parameters: [parameter] });
        }

        const bodyComponent = components.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const bodyVars = getVars(bodyComponent.text);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => {
                    const mapping = variableMappings?.find(m => m.var === String(varNum));
                    const value = mapping ? contact.variables?.[mapping.value] : '';
                    return { type: 'text', text: value || '' };
                });
                payloadComponents.push({ type: 'body', parameters });
            }
        }
        
        const messageData = {
            messaging_product: 'whatsapp', to: contact.phone, recipient_type: 'individual', type: 'template',
            template: { name: templateName, language: { code: language || 'en_US' }, ...(payloadComponents.length > 0 && { components: payloadComponents }) },
        };
        
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, messageData, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        
        const messageId = response.data?.messages?.[0]?.id;
        if (!messageId) return { success: false, contactId: contact._id, error: "No message ID returned from Meta." };

        return { success: true, contactId: contact._id, messageId };
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
        return { success: false, contactId: contact._id, error: errorMessage };
    }
}


// --- Main Worker Function ---
async function startBroadcastWorker(workerId) {
    const { db } = await connectToDatabase();
    const redis = await getRedisClient();
    const rateLimiter = createTokenBucketRateLimiter(redis);
    
    const updateOps = [];
    const broadcastCounterUpdates = {};
    let successCount = 0;
    let errorCount = 0;

    const flushUpdates = async () => {
        if (updateOps.length > 0) {
            await db.collection('broadcast_contacts').bulkWrite(updateOps, { ordered: false });
            updateOps.length = 0;
        }
        const counterOps = Object.entries(broadcastCounterUpdates).map(([broadcastId, counts]) => ({
            updateOne: { 
                filter: { _id: new ObjectId(broadcastId) }, 
                update: { $inc: { successCount: counts.success, errorCount: counts.fail } } 
            }
        }));
        if (counterOps.length > 0) {
            await db.collection('broadcasts').bulkWrite(counterOps, { ordered: false });
            Object.keys(broadcastCounterUpdates).forEach(key => delete broadcastCounterUpdates[key]);
        }
    };

    // Flush updates periodically
    const flushInterval = setInterval(flushUpdates, 2000);

    console.log(`[Worker ${workerId}] Starting to listen for tasks...`);

    while (true) {
        try {
            const taskJson = await redis.brPop('broadcast_queue', 0);
            if (!taskJson || !taskJson.element) continue;

            const task = JSON.parse(taskJson.element);
            const [job, contact, project] = await Promise.all([
                db.collection('broadcasts').findOne({ _id: new ObjectId(task.jobId) }),
                db.collection('broadcast_contacts').findOne({ _id: new ObjectId(task.contactId) }),
                db.collection('projects').findOne({ _id: new ObjectId(task.projectId) })
            ]);

            if (!job || !contact || !project) {
                console.error(`[Worker ${workerId}] Skipping task due to missing data:`, task);
                continue;
            }

            const delay = await rateLimiter(task.projectId, project.messagesPerSecond || 80);
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const result = await sendWhatsAppMessage(db, job, contact);

            const broadcastIdStr = job._id.toString();
            if (!broadcastCounterUpdates[broadcastIdStr]) {
                 broadcastCounterUpdates[broadcastIdStr] = { success: 0, fail: 0 };
            }

            if (result.success) {
                successCount++;
                broadcastCounterUpdates[broadcastIdStr].success++;
                updateOps.push({
                    updateOne: {
                        filter: { _id: result.contactId },
                        update: { $set: { status: 'SENT', sentAt: new Date(), messageId: result.messageId, error: null } }
                    }
                });
            } else {
                errorCount++;
                broadcastCounterUpdates[broadcastIdStr].fail++;
                updateOps.push({
                    updateOne: {
                        filter: { _id: result.contactId },
                        update: { $set: { status: 'FAILED', error: result.error } }
                    }
                });
            }

            if (updateOps.length >= DB_WRITE_BATCH_SIZE) {
                await flushUpdates();
            }

        } catch (err) {
            console.error(`[Worker ${workerId}] Error processing task:`, err);
            // Wait a bit before continuing to prevent rapid-fire errors
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    clearInterval(flushInterval);
    await flushUpdates(); // Final flush before exiting
}

module.exports = { startBroadcastWorker };
