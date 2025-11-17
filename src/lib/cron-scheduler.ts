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
    await addBroadcastLog(
      db,
      broadcastId,
      projectId,
      'WARN',
      `Broadcast ${broadcastId} had no pending contacts.`
    );
    return { success: true, message: `Job ${broadcastId} completed with no pending contacts.` };
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

  const speedLimit = job.speedLimit || 80; // Messages per second
  const batchSize = KAFKA_MESSAGE_BATCH_SIZE;
  const batchesPerSecond = Math.ceil(speedLimit / batchSize);
  const delayPerBatch = 1000 / batchesPerSecond;

  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  try {
    await producer.connect();
    console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Kafka producer connected.`);

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      try {
        await producer.send({
          topic: KAFKA_TOPIC,
          messages: [{ value: JSON.stringify({ jobDetails: job, contacts: batch }) }],
        });

        successCount += batch.length;
        await db.collection('broadcast_contacts').updateMany(
          { _id: { $in: batch.map(c => c._id) } },
          { $set: { status: 'SENT' } }
        );

        // Real-time speed tracking
        const elapsed = (Date.now() - startTime) / 1000;
        const currentSpeed = Math.round(successCount / elapsed);
        process.stdout.write(
          `\r[Job ${broadcastId}] Sent: ${successCount}/${contacts.length} | Speed: ${currentSpeed} msg/s | Limit: ${speedLimit} msg/s`
        );

        // Respect Messages Per Second limit
        await new Promise((res) => setTimeout(res, delayPerBatch));
      } catch (err) {
        const errMsg = getErrorMessage(err);
        errorCount += batch.length;
        await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Failed batch: ${errMsg}`);
      }
    }

    // Mark job completed
    await db.collection('broadcasts').updateOne(
      { _id: broadcastId },
      { $set: { status: 'Completed', completedAt: new Date(), successCount, errorCount } }
    );

    console.log(`\n[CRON-SCHEDULER] Job ${broadcastId} completed. Success: ${successCount}, Failed: ${errorCount}`);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Job completed. Success: ${successCount}, Failed: ${errorCount}`);

    return { success: true, message: `Successfully queued ${contacts.length} contacts for job ${broadcastId}.` };
  } catch (err) {
    const jobError = getErrorMessage(err);
    console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed: ${jobError}`);
    await addBroadcastLog(db, broadcastId, projectId, 'ERROR', jobError);
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

  const jobResult = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
    { status: 'QUEUED' },
    { $set: { status: 'PROCESSING', startedAt: new Date() } },
    { returnDocument: 'after', sort: { createdAt: 1 } }
  );

  const job = jobResult.value;

  if (!job) {
    const msg = 'No queued broadcast jobs found to process.';
    console.log(`[CRON-SCHEDULER] ${msg}`);
    return { message: msg, error: null };
  }

  try {
    const result = await processSingleJob(db, job);
    return result;
  } catch (error: any) {
    const baseErrorMessage = `Broadcast processing failed for job ${job._id}: ${getErrorMessage(error)}`;
    console.error(`[CRON-SCHEDULER] ${baseErrorMessage}`, { stack: error.stack });

    await addBroadcastLog(db, job._id, job.projectId, 'ERROR', baseErrorMessage, { stack: error.stack });
    await db.collection('broadcasts').updateOne(
      { _id: job._id, status: 'PROCESSING' },
      { $set: { status: 'QUEUED', lastError: baseErrorMessage }, $unset: { startedAt: '' } }
    );
    return { message: null, error: baseErrorMessage };
  }
}
