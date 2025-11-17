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
const ONE_HUNDRED_MEGABYTES = 100 * 1024 * 1024;
const STUCK_JOB_TIMEOUT_MINUTES = 10;
const MAX_BATCH_SIZE_CONTACTS = 1000; // Max number of contacts per Kafka message

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
    const jobState = await db.collection('broadcasts').findOne({ _id: broadcastId });
    if (jobState && (jobState.successCount + jobState.errorCount) >= jobState.contactCount) {
      await db.collection('broadcasts').updateOne(
        { _id: broadcastId },
        { $set: { status: 'Completed', completedAt: new Date() } }
      );
      const msg = `Job ${broadcastId} has no pending contacts. Marked as complete.`;
      console.log(`[CRON-SCHEDULER] ${msg}`);
      await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
    } else {
      const msg = `Job ${broadcastId} has no pending contacts, but counts don't match total. It may be processing or finished.`;
      console.log(`[CRON-SCHEDULER] ${msg}`);
      await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
    }
    return { success: true, message: "Job has no pending contacts." };
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

  try {
    await producer.connect();

    let messagesSentToKafka = 0;
    for (let i = 0; i < contacts.length; i += MAX_BATCH_SIZE_CONTACTS) {
      const batch = contacts.slice(i, i + MAX_BATCH_SIZE_CONTACTS);
      const messageString = JSON.stringify({ jobDetails: job, contacts: batch });
      await producer.send({ topic: KAFKA_TOPIC, messages: [{ value: messageString }] });
      messagesSentToKafka += batch.length;
    }

    const message = `Queued ${messagesSentToKafka}/${contacts.length} contacts for job ${broadcastId}.`;
    console.log(`[CRON-SCHEDULER] ${message}`);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', message);

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

  const job = jobResult.value as WithId<BroadcastJobType> | null;

  if (!job) {
    const msg = 'No queued broadcast jobs found.';
    console.log(`[CRON-SCHEDULER] ${msg}`);
    return { message: msg, error: null };
  }

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
