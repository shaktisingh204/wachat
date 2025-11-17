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
  const speedLimit = job.messagesPerSecond || 80;

  const pThrottle = await importPThrottle();
  const throttle = pThrottle({
    limit: speedLimit,
    interval: 1000,
  });

  try {
    await producer.connect();

    let messagesSent = 0;
    const batchSize = 50; // Kafka batch size for efficiency

    const sendMessageWithThrottle = throttle(async (contact: any) => {
      // Stop sending if all contacts are already processed
      const jobData = await db.collection('broadcasts').findOne({ _id: broadcastId });
      if ((jobData.successCount + jobData.errorCount) >= jobData.contactCount) {
        return null;
      }

      const messageString = JSON.stringify({ jobDetails: job, contacts: [contact] });
      try {
        await producer.send({ topic: KAFKA_TOPIC, messages: [{ value: messageString }] });
        messagesSent++;
      } catch (kafkaError) {
        const errorMsg = `Failed to send message for contact ${contact._id}: ${getErrorMessage(kafkaError)}`;
        allErrors.push(errorMsg);
        await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMsg, { stack: (kafkaError as Error).stack });
      }
      return true;
    });

    const promises: Promise<any>[] = [];
    for (const contact of contacts) {
      promises.push(sendMessageWithThrottle(contact));
    }

    await Promise.all(promises);

    // Update counts in DB
    if (messagesSent > 0 || allErrors.length > 0) {
      const updateResult = await db.collection('broadcasts').findOneAndUpdate(
        { _id: broadcastId },
        { $inc: { successCount: messagesSent, errorCount: allErrors.length } },
        { returnDocument: 'after' }
      );

      if (updateResult.value && (updateResult.value.successCount + updateResult.value.errorCount) >= updateResult.value.contactCount) {
        await db.collection('broadcasts').updateOne(
          { _id: broadcastId },
          { $set: { status: 'Completed', completedAt: new Date() } }
        );
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Job marked as Completed.`);
        console.log(`[CRON-SCHEDULER] [JOB ${broadcastId}] Final batch processed. Marked job as Completed.`);
      }
    }

    const message = `Queued ${messagesSent}/${contacts.length} contacts for job ${broadcastId}.`;
    console.log(`[CRON-SCHEDULER] ${message}`);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', message);

    if (allErrors.length > 0) {
      throw new Error(`Encountered ${allErrors.length} errors while sending to Kafka.`);
    }

    return { success: true, message: `Job queued successfully.` };
  } catch (err) {
    const jobError = getErrorMessage(err);
    console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed: ${jobError}`);
    await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Scheduler failed: ${jobError}`);
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

  if (!jobResult.value) {
    const msg = 'No queued broadcast jobs found.';
    console.log(`[CRON-SCHEDULER] ${msg}`);
    return { message: msg, error: null };
  }

  const job = jobResult.value as WithId<BroadcastJobType>;
  
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
