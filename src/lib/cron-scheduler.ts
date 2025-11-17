
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka, Partitioners } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType, WithId } from './definitions';
import { getErrorMessage } from './utils';

const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const LOW_PRIORITY_TOPIC = 'low-priority-broadcasts';
const HIGH_PRIORITY_TOPIC = 'high-priority-broadcasts';
const KAFKA_MESSAGE_BATCH_SIZE = 200;
const ONE_HUNDRED_MEGABYTES = 100 * 1024 * 1024;
const STUCK_JOB_TIMEOUT_MINUTES = 10;

const addBroadcastLog = async (
  db: Db,
  broadcastId: ObjectId,
  projectId: ObjectId,
  level: 'INFO' | 'ERROR' | 'WARN',
  message: string,
  meta?: Record<string, any>
) => {
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
    console.error('Failed to write broadcast log:', e);
  }
};

async function resetStuckJobs(db: Db) {
  const tenMinutesAgo = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
  const result = await db.collection('broadcasts').updateMany(
    { status: 'PROCESSING', startedAt: { $lt: tenMinutesAgo } },
    { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast job(s).`);
  }
}

async function markCompletedJobs(db: Db) {
  const result = await db.collection('broadcasts').updateMany(
    {
      status: 'PROCESSING',
      $expr: { $gte: [{ $add: ['$successCount', '$errorCount'] }, '$contactCount'] },
    },
    {
      $set: { status: 'Completed', completedAt: new Date() },
    }
  );
  if (result.modifiedCount > 0) {
    console.log(`[CRON-SCHEDULER] Marked ${result.modifiedCount} finished broadcast job(s) as Completed.`);
  }
}

async function processSingleJob(db: Db, job: WithId<BroadcastJobType>) {
  const broadcastId = job._id;
  const projectId = job.projectId;

  await addBroadcastLog(
    db,
    broadcastId,
    projectId,
    'INFO',
    `Cron job picked up broadcast ${broadcastId} and set status to PROCESSING.`
  );

  const contacts = await db
    .collection('broadcast_contacts')
    .find({ broadcastId: broadcastId, status: 'PENDING' })
    .toArray();

  if (contacts.length === 0) {
    await db.collection('broadcasts').updateOne(
      { _id: broadcastId },
      { $set: { status: 'Completed', completedAt: new Date() } }
    );
    const msg = `Job ${broadcastId} completed with no pending contacts.`;
    console.log(`[CRON-SCHEDULER] Finished job ${broadcastId}: ${msg}`);
    await addBroadcastLog(
      db,
      broadcastId,
      projectId,
      'WARN',
      `Broadcast ${broadcastId} had no pending contacts.`
    );
    return { success: true, message: msg };
  }

  const KAFKA_TOPIC = contacts.length > 5000 ? HIGH_PRIORITY_TOPIC : LOW_PRIORITY_TOPIC;
  await addBroadcastLog(
    db,
    broadcastId,
    projectId,
    'INFO',
    `Found ${contacts.length} contacts. Routing to topic: ${KAFKA_TOPIC}.`
  );
  console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Found ${contacts.length} contacts. Routing to topic: ${KAFKA_TOPIC}.`);

  const kafka = new Kafka({
    clientId: `broadcast-producer-${broadcastId}`,
    brokers: KAFKA_BROKERS,
    connectionTimeout: 5000,
    requestTimeout: 30000,
  });

  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    maxRequestSize: ONE_HUNDRED_MEGABYTES,
  });

  const speedLimit = job.messagesPerSecond || 80; // Messages per second
  const batchSize = KAFKA_MESSAGE_BATCH_SIZE;
  const batchesPerSecond = Math.ceil(speedLimit / batchSize);
  const delayPerBatch = 1000 / batchesPerSecond;

  let messagesSentToKafka = 0;
  const allErrors = [];

  try {
    await producer.connect();
    console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Kafka producer connected.`);

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const messageString = JSON.stringify({ jobDetails: job, contacts: batch });
      
      console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Sending batch ${i/batchSize + 1} with ${batch.length} contacts.`);
      try {
        await producer.send({
          topic: KAFKA_TOPIC,
          messages: [{ value: messageString }],
        });
        messagesSentToKafka += batch.length;
      } catch (kafkaError: any) {
        const errorMsg = `Failed to send batch ${i/batchSize + 1} to Kafka: ${getErrorMessage(kafkaError)}`;
        console.error(`[CRON-SCHEDULER] ${errorMsg}`);
        allErrors.push(errorMsg);
        await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMsg, { stack: kafkaError.stack });
      }

      await new Promise((res) => setTimeout(res, delayPerBatch));
    }

    const finalMessage = `Successfully queued ${messagesSentToKafka} contacts for job ${broadcastId}. Failed to queue: ${contacts.length - messagesSentToKafka}.`;
    console.log(`[CRON-SCHEDULER] Finished job ${broadcastId}: ${finalMessage}`);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', finalMessage);

    return { success: true, message: finalMessage };
  } catch (err) {
    const jobError = getErrorMessage(err);
    console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed: ${jobError}`);
    await addBroadcastLog(db, broadcastId, projectId, 'ERROR', jobError);
    // Revert status to QUEUED if the producer fails catastrophically before sending
     await db.collection('broadcasts').updateOne(
        { _id: broadcastId, status: 'PROCESSING' },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } }
    );
    return { success: false, error: jobError };
  } finally {
    await producer.disconnect();
    console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Kafka producer disconnected.`);
  }
}

export async function processBroadcastJob() {
  console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);
  let db: Db;

  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (dbError) {
    const errorMsg = getErrorMessage(dbError);
    console.error('[CRON-SCHEDULER] Database connection failed:', errorMsg);
    return { message: null, error: 'Could not connect to the database.' };
  }

  try {
    await resetStuckJobs(db);
    await markCompletedJobs(db);
  } catch (maintenanceError) {
    console.error('[CRON-SCHEDULER] Error during maintenance tasks:', maintenanceError);
  }

  const jobResult = await db.collection('broadcasts').findOneAndUpdate(
    { status: 'QUEUED' },
    { $set: { status: 'PROCESSING', startedAt: new Date() } },
    { returnDocument: 'after', sort: { createdAt: 1 } }
  );

  const job = jobResult; // The result from findOneAndUpdate is the document itself in v5+

  if (!job) {
    const msg = 'No queued broadcast jobs found to process.';
    console.log(`[CRON-SCHEDULER] ${msg}`);
    return { message: msg, error: null };
  }

  // The job is now "locked" with PROCESSING status. We can process it without awaiting.
  // This makes the cron URL return immediately. The actual work happens in the background.
  processSingleJob(db, job).catch(error => {
    const errorMessage = getErrorMessage(error);
    console.error(`[CRON-SCHEDULER] Unhandled error in processSingleJob for job ${job._id}:`, errorMessage);
    addBroadcastLog(db, job._id, job.projectId, 'ERROR', `Unhandled critical error: ${errorMessage}`);
    // Attempt to revert status so it might be picked up again
    db.collection('broadcasts').updateOne(
        { _id: job._id, status: 'PROCESSING' },
        { $set: { status: 'QUEUED', lastError: errorMessage }, $unset: { startedAt: "" } }
    );
  });
  
  return { message: `Job ${job._id} picked up and is now being processed.`, error: null };
}

    