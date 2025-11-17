'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka, Partitioners } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType, WithId } from './definitions';
import { getErrorMessage } from './utils';

let pThrottle: any;
const importPThrottle = async () => {
  if (!pThrottle) {
    pThrottle = (await import('p-throttle')).default;
  }
  return pThrottle;
};

const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const LOW_PRIORITY_TOPIC = 'low-priority-broadcasts';
const HIGH_PRIORITY_TOPIC = 'high-priority-broadcasts';
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

  let contacts = await db
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
  
  const allErrors: string[] = [];

  const pThrottle = await importPThrottle();
  const speedLimit = job.messagesPerSecond || 80;
  const batchSize = speedLimit; // Set batch size directly to the desired messages per second
  
  const throttle = pThrottle({
      limit: 1, // Send one batch
      interval: 1000 // per second
  });

  try {
    await producer.connect();

    const throttledPushToKafka = throttle(async (batch: any[], batchIndex: number) => {
        const messageString = JSON.stringify({ jobDetails: job, contacts: batch });
        try {
            console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Sending batch ${batchIndex + 1} with ${batch.length} contacts.`);
            await producer.send({ topic: KAFKA_TOPIC, messages: [{ value: messageString }] });
        } catch (kafkaError) {
            const errorMsg = `Failed to send batch ${batchIndex + 1} to Kafka: ${getErrorMessage(kafkaError)}`;
            console.error(`[CRON-SCHEDULER] ${errorMsg}`);
            allErrors.push(errorMsg);
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMsg, { stack: (kafkaError as Error).stack });
        }
    });

    const batchPromises = [];
    for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        batchPromises.push(throttledPushToKafka(batch, i / batchSize));
    }

    await Promise.all(batchPromises);

    const message = `All ${contacts.length} contacts for job ${broadcastId} have been queued for sending.`;
    console.log(`[CRON-SCHEDULER] ${message}`);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', message);

    if (allErrors.length > 0) {
      throw new Error(`Encountered ${allErrors.length} errors while sending to Kafka.`);
    }

    return { success: true, message: `Job queued successfully.` };
  } catch (err) {
    const jobError = getErrorMessage(err);
    console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed to queue all contacts: ${jobError}`);
    await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Scheduler failed: ${jobError}`);
    // Revert status to QUEUED on failure to queue
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

  const jobDoc = jobResult.value; // ✅ FIX: get the actual document

  if (!jobDoc) {
    const msg = 'No queued broadcast jobs found.';
    console.log(`[CRON-SCHEDULER] ${msg}`);
    return { message: msg, error: null };
  }

  const job = jobDoc as WithId<BroadcastJobType>;
  
  // Asynchronously process the job without blocking the response
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
