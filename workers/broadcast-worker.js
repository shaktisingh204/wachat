require('dotenv').config();
const { connectToDatabase } = require('../src/lib/mongodb.js');
const { getErrorMessage } = require('../src/lib/utils.js');
const { Kafka } = require('kafkajs');
const undici = require('undici');

const API_VERSION = 'v23.0';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(',');
const MAX_BATCH_PROCESS = 1000; // max contacts per Kafka message

const addBroadcastLog = async (db, broadcastId, projectId, level, message, meta) => {
  try {
    if (!db || !broadcastId || !projectId) return;
    await db.collection('broadcast_logs').insertOne({
      broadcastId,
      projectId,
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error('Failed to write broadcast log in worker:', e);
  }
};

async function sendWhatsAppMessage(job, contact) {
  try {
    const {
      accessToken, phoneNumberId, templateName, language, components,
      headerImageUrl, headerMediaId, variableMappings
    } = job;

    const getVars = text => {
      if (!text) return [];
      const matches = text.match(/{{\s*(\d+)\s*}}/g);
      return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
    };

    const payloadComponents = [];
    const headerComponent = components.find(c => c.type === 'HEADER');
    if (headerComponent) {
      const format = headerComponent.format?.toLowerCase();
      let parameter;
      if (['image','video','document'].includes(format)) {
        if (headerMediaId) parameter = { type: format, [format]: { id: headerMediaId } };
        else if (headerImageUrl) parameter = { type: format, [format]: { link: headerImageUrl } };
      } else if (format === 'text' && headerComponent.text) {
        const headerVars = getVars(headerComponent.text);
        if (headerVars.length > 0) {
          const varKey = `header_variable${headerVars[0]}`;
          const value = contact.variables?.[varKey] || '';
          if (value) parameter = { type: 'text', text: value };
        }
      }
      if (parameter) payloadComponents.push({ type: 'header', parameters: [parameter] });
    }

    const bodyComponent = components.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const bodyVars = getVars(bodyComponent.text);
      if (bodyVars.length > 0) {
        const parameters = bodyVars
          .sort((a,b) => a-b)
          .map(num => {
            const mapping = variableMappings?.find(m => m.var === String(num));
            const key = mapping ? mapping.value : `body_variable${num}`;
            return { type: 'text', text: contact.variables?.[key] || '' };
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
        language: { code: language || 'en_US' },
        ...(payloadComponents.length>0 && { components: payloadComponents })
      }
    };

    const { statusCode, body } = await undici.request(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      { method:'POST', headers:{ Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json' }, body: JSON.stringify(messageData) }
    );

    const res = await body.json();
    if (statusCode<200 || statusCode>=300) throw new Error(JSON.stringify(res?.error || res));
    const messageId = res?.messages?.[0]?.id;
    if (!messageId) return { success:false, error:'No message ID returned from Meta.' };
    return { success:true, messageId };

  } catch (err) {
    return { success:false, error:getErrorMessage(err) };
  }
}

async function startBroadcastWorker(workerId) {
  const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'low-priority-broadcasts';
  const GROUP_ID = `whatsapp-broadcaster-${KAFKA_TOPIC}`;
  console.log(`[WORKER ${workerId}] Starting on topic: ${KAFKA_TOPIC}`);

  const { db } = await connectToDatabase();
  const kafka = new Kafka({ clientId:`worker-${workerId}`, brokers:KAFKA_BROKERS });
  const consumer = kafka.consumer({ groupId:GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning:true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const { jobDetails, contacts } = JSON.parse(message.value.toString());
      if (!jobDetails || !Array.isArray(contacts)) return;

      const { ObjectId } = require('mongodb');
      const broadcastId = new ObjectId(jobDetails._id);
      const projectId = new ObjectId(jobDetails.projectId);
      console.log(`[WORKER ${workerId}] Processing ${contacts.length} contacts for ${broadcastId}`);

      const speedLimit = jobDetails.messagesPerSecond || 80;
      const interval = 1000 / speedLimit; // milliseconds per message

      let successCount=0, errorCount=0, bulkOps=[];
      for (const contact of contacts) {
        await new Promise(res => setTimeout(res, interval));
        const result = await sendWhatsAppMessage(jobDetails, contact);
        const updateOp = result.success ? {
          updateOne: { filter:{ _id:new ObjectId(contact._id) }, update:{ $set:{ status:'SENT', sentAt:new Date(), messageId:result.messageId, error:null } } }
        } : {
          updateOne: { filter:{ _id:new ObjectId(contact._id) }, update:{ $set:{ status:'FAILED', error:result.error } } }
        };
        bulkOps.push(updateOp);
        if (result.success) successCount++; else errorCount++;
      }

      if (bulkOps.length>0) await db.collection('broadcast_contacts').bulkWrite(bulkOps,{ordered:false});
      const updatedJob = await db.collection('broadcasts').findOneAndUpdate(
        { _id:broadcastId }, { $inc:{ successCount, errorCount } }, { returnDocument:'after' }
      );

      if (updatedJob && (updatedJob.successCount+updatedJob.errorCount)>=updatedJob.contactCount) {
        await db.collection('broadcasts').updateOne({ _id:broadcastId }, { $set:{ status:'Completed', completedAt:new Date() } });
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Job Completed. Success:${successCount}, Failed:${errorCount}`);
      }

      console.log(`[WORKER ${workerId}] Batch finished. Success:${successCount}, Failed:${errorCount}`);
    }
  });
}

module.exports = { startBroadcastWorker };
