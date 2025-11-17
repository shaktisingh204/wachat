
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

async function processSingleJob(db: Db, job: WithId<BroadcastJobType>) {
  const broadcastId = job._id;
  const projectId = job.projectId;

  await addBroadcastLog(
    db,
    broadcastId,
    projectId,
    'INFO',
    `Scheduler picked up job ${broadcastId} for processing.`
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
    const msg = `Job ${broadcastId} has no pending contacts. Marked as complete.`;
    console.log(`[CRON-SCHEDULER] ${msg}`);
    await addBroadcastLog(db, broadcastId, projectId, 'WARN', msg);
    return { success: true, message: msg };
  }

  const KAFKA_TOPIC = contacts.length > 5000 ? HIGH_PRIORITY_TOPIC : LOW_PRIORITY_TOPIC;

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

  const batchSize = KAFKA_MESSAGE_BATCH_SIZE;
  const allErrors: string[] = [];

  try {
    await producer.connect();

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const messageString = JSON.stringify({ jobDetails: job, contacts: batch });
      
      console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Sending batch ${i/batchSize + 1} with ${batch.length} contacts.`);

      try {
        await producer.send({
          topic: KAFKA_TOPIC,
          messages: [{ value: messageString }],
        });
      } catch (kafkaError: any) {
        const errorMsg = `Failed to send batch ${i/batchSize + 1} to Kafka: ${getErrorMessage(kafkaError)}`;
        console.error(`[CRON-SCHEDULER] ${errorMsg}`);
        allErrors.push(errorMsg);
        await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMsg, { stack: kafkaError.stack });
      }
    }
    
    // IMPORTANT: The scheduler's job is done here. It has queued all messages.
    // It should NOT mark the job as complete. The workers will do that.
    console.log(`[CRON-SCHEDULER] Job ${broadcastId}: All ${contacts.length} contacts have been pushed to Kafka topic "${KAFKA_TOPIC}".`);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `All ${contacts.length} contacts queued to Kafka.`);
    
    if (allErrors.length > 0) {
      return { success: false, error: `Finished queueing with ${allErrors.length} batch error(s).` };
    }

    return { success: true, message: `All contacts for job ${broadcastId} have been successfully queued.` };

  } catch (err: any) {
    const jobError = getErrorMessage(err);
    console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed catastrophically: ${jobError}`);
    await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Fatal scheduler error: ${jobError}`);

    await db.collection('broadcasts').updateOne(
      { _id: broadcastId, status: 'PROCESSING' },
      { $set: { status: 'QUEUED', lastError: jobError }, $unset: { startedAt: '' } }
    );
    return { success: false, error: jobError };
  } finally {
    await producer.disconnect();
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
  } catch (maintenanceError) {
    console.error('[CRON-SCHEDULER] Maintenance error (resetting jobs):', maintenanceError);
  }

  const jobResult = await db.collection('broadcasts').findOneAndUpdate(
    { status: 'QUEUED' },
    { $set: { status: 'PROCESSING', startedAt: new Date() } },
    { returnDocument: 'after', sort: { createdAt: 1 } }
  );

  const job = jobResult;

  if (!job) {
    const msg = 'No queued broadcast jobs found.';
    console.log(`[CRON-SCHEDULER] ${msg}`);
    return { message: msg, error: null };
  }

  // Asynchronously process the job so the HTTP request can return immediately.
  processSingleJob(db, job).catch(err => {
    const errMsg = getErrorMessage(err);
    console.error(`[CRON-SCHEDULER] Unhandled error in job ${job._id}: ${errMsg}`);
    addBroadcastLog(db, job._id, job.projectId, 'ERROR', `Unhandled scheduler error: ${errMsg}`);
    db.collection('broadcasts').updateOne(
      { _id: job._id, status: 'PROCESSING' },
      { $set: { status: 'QUEUED', lastError: errMsg }, $unset: { startedAt: '' } }
    );
  });

  return { message: `Job ${job._id} picked up and is being processed.`, error: null };
}
