const { connectToDatabase } = require('./mongodb');
const { getRedisClient } = require('./redis');
const axios = require('axios');
const { getErrorMessage } = require('./utils');
const { ObjectId } = require('mongodb');

const API_VERSION = 'v23.0';

/**
 * Sends a single WhatsApp message using a pre-constructed job and contact object.
 */
async function sendWhatsAppMessage(job, contact) {
    try {
        const { accessToken, phoneNumberId, templateName, language, components, headerImageUrl, headerMediaId, variableMappings } = job;
        
        const getVars = (text) => {
            if (!text) return [];
            const matches = text.match(/{{\s*(\d+)\s*}}/g);
            return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
        };

        const interpolate = (text, variables) => {
            if (!text) return '';
            return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (match, key) => {
                const value = variables[key];
                return value !== undefined ? String(value) : match;
            });
        };

        const payloadComponents = [];
        const headerComponent = components.find(c => c.type === 'HEADER');
        if (headerComponent) {
            let parameter;
            const format = headerComponent.format?.toLowerCase();
            if (headerMediaId) {
                parameter = { type: format, [format]: { id: headerMediaId } };
            } else if (headerImageUrl) {
                parameter = { type: format, [format]: { link: headerImageUrl } };
            } else if (format === 'text' && headerComponent.text) {
                 if (getVars(headerComponent.text).length > 0) {
                     parameter = { type: 'text', text: interpolate(headerComponent.text, contact.variables || {}) };
                 }
            }
            if (parameter) payloadComponents.push({ type: 'header', parameters: [parameter] });
        }
        
        const bodyComponent = components.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const bodyVars = getVars(bodyComponent.text);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => {
                    const mapping = variableMappings?.find(m => m.var === String(varNum));
                    const varKey = mapping ? mapping.value : `variable${varNum}`;
                    const value = contact.variables?.[varKey] || '';
                    return { type: 'text', text: value };
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
        if (!messageId) return { success: false, error: "No message ID returned from Meta." };

        return { success: true, messageId };
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        return { success: false, error: errorMessage };
    }
}

/**
 * The main function for a worker process. It continuously pulls jobs from Redis and processes them.
 */
async function startBroadcastWorker(workerId) {
  console.log(`[Worker ${workerId}] Connecting to databases...`);
  const { db } = await connectToDatabase();
  const redis = await getRedisClient();
  console.log(`[Worker ${workerId}] Connections established. Listening to 'broadcast-queue'.`);
  
  while (true) {
    try {
      // Blocking pop from the right of the list (FIFO). Waits indefinitely for a job.
      const result = await redis.blPop('broadcast-queue', 0);
      const jobString = result.element;
      
      const { jobDetails, contacts } = JSON.parse(jobString);
      
      console.log(`[Worker ${workerId}] Processing micro-batch of ${contacts.length} for broadcast ${jobDetails._id}`);

      const contactPromises = contacts.map(contact => 
        sendWhatsAppMessage(jobDetails, contact)
            .then(result => ({ contactId: contact._id, ...result }))
      );
      
      const results = await Promise.allSettled(contactPromises);
      
      const bulkOps = [];
      let successCount = 0;
      let errorCount = 0;

      for (const res of results) {
          if (res.status === 'fulfilled') {
              const { contactId, success, messageId, error } = res.value;
              if (success) {
                  successCount++;
                  bulkOps.push({ updateOne: { filter: { _id: new ObjectId(contactId) }, update: { $set: { status: 'SENT', sentAt: new Date(), messageId, error: null } } } });
              } else {
                  errorCount++;
                  bulkOps.push({ updateOne: { filter: { _id: new ObjectId(contactId) }, update: { $set: { status: 'FAILED', error } } } });
              }
          } else {
              errorCount++;
              console.error(`[Worker ${workerId}] A send promise was rejected:`, res.reason);
          }
      }

      if (bulkOps.length > 0) {
          await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
      }
      
      await db.collection('broadcasts').updateOne(
        { _id: new ObjectId(jobDetails._id) },
        { $inc: { successCount, errorCount } }
      );
      
      console.log(`[Worker ${workerId}] Finished micro-batch for broadcast ${jobDetails._id}. Success: ${successCount}, Failed: ${errorCount}.`);

    } catch (error) {
      console.error(`[Worker ${workerId}] Critical error in processing loop:`, error);
      // Wait for a moment before trying to pull another job to prevent a fast failure loop
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

module.exports = { startBroadcastWorker };
