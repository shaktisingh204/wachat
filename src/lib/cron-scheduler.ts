'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka, Partitioners } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType, WithId } from './definitions';
import { getErrorMessage } from './utils';
import PQueue from 'p-queue';

const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const LOW_PRIORITY_TOPIC = 'low-priority-broadcasts';
const HIGH_PRIORITY_TOPIC = 'high-priority-broadcasts';
const KAFKA_BATCH_SIZE = 500; // contacts per Kafka message
const STUCK_JOB_TIMEOUT_MINUTES = 10;
const DEFAULT_SPEED = 80; // messages per second

// Add log to MongoDB
async function addBroadcastLog(
  db: Db,
  broadcastId: ObjectId,
  projectId: ObjectId,
  level: 'INFO' | 'ERROR' | 'WARN',
  message: string,
  meta?: Record<string, any>
) {
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
    console.error("Failed to write broadcast log:", e);
  }
}

// Reset stuck jobs
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

// Mark completed jobs
async function markCompletedJobs(db: Db) {
  const result = await db.collection('broadcasts').updateMany(
    {
      status: 'PROCESSING',
      $expr: { $gte: [{ $add: ["$successCount", "$errorCount"] }, "$contactCount"] }
    },
    { $set: { status: 'Completed', completedAt: new Date() } }
  );
  if (result.modifiedCount > 0) {
    console.log(`[CRON-SCHEDULER] Marked ${result.modifiedCount} finished broadcast job(s) as Completed.`);
  }
}

// Process single broadcast job with speed tracking
async function processSingleJob(db: Db, job: WithId<BroadcastJobType>) {
  const broadcastId = job._id;
  const projectId = job.projectId;
  const speedLimit = job.speedLimit || DEFAULT_SPEED;

  await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Job started with concurrency ${speedLimit}.`);

  const contacts = await db.collection('broadcast_contacts').find({ broadcastId, status: 'PENDING' }).toArray();

  if (!contacts.length) {
    await db.collection('broadcasts').updateOne(
      { _id: broadcastId },
      { $set: { status: 'Completed', completedAt: new Date() } }
    );
    await addBroadcastLog(db, broadcastId, projectId, 'WARN', `Broadcast ${broadcastId} had no pending contacts.`);
    return { success: true, message: `Job ${broadcastId} completed with no pending contacts.` };
  }

  const KAFKA_TOPIC = contacts.length > 5000 ? HIGH_PRIORITY_TOPIC : LOW_PRIORITY_TOPIC;
  const kafka = new Kafka({
    clientId: `broadcast-producer-${broadcastId}`,
    brokers: KAFKA_BROKERS,
    connectionTimeout: 5000,
    requestTimeout: 30000,
  });
  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  await producer.connect();
  console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Kafka producer connected.`);

  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  const queue = new PQueue({ concurrency: speedLimit });

  for (let i = 0; i < contacts.length; i += KAFKA_BATCH_SIZE) {
    const batch = contacts.slice(i, i + KAFKA_BATCH_SIZE);

    queue.add(async () => {
      try {
        await producer.send({
          topic: KAFKA_TOPIC,
          messages: [{ value: JSON.stringify({ job, contacts: batch }) }]
        });

        // Update counters
        successCount += batch.length;
        await db.collection('broadcast_contacts').updateMany(
          { _id: { $in: batch.map(c => c._id) } },
          { $set: { status: 'SENT' } }
        );

        // Real-time speed tracking
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        const currentSpeed = Math.round(successCount / elapsed);
        process.stdout.write(`\r[Job ${broadcastId}] Sent: ${successCount} / ${contacts.length} | Speed: ${currentSpeed} msg/s`);

      } catch (err) {
        const errMsg = getErrorMessage(err);
        errorCount += batch.length;
        await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Failed to send batch: ${errMsg}`, { stack: err.stack });
      }
    });
  }

  await queue.onIdle();
  await producer.disconnect();

  // Final counters
  await db.collection('broadcasts').updateOne(
    { _id: broadcastId },
    {
      $set: {
        successCount,
        errorCount,
        status: successCount + errorCount >= contacts.length ? 'Completed' : 'PROCESSING'
      }
    }
  );

  console.log(`\n[CRON-SCHEDULER] Job ${broadcastId} completed: Sent ${successCount}, Failed ${errorCount}`);

  await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Job completed: Sent ${successCount}, Failed ${errorCount}.`);

  return { success: true, successCount, errorCount };
}

// Main broadcast job processor
export async function processBroadcastJob() {
  console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);

  let db: Db;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (dbError) {
    console.error("[CRON-SCHEDULER] Database connection failed:", getErrorMessage(dbError));
    return { message: null, error: "Could not connect to the database." };
  }

  try {
    await resetStuckJobs(db);
    await markCompletedJobs(db);
  } catch (maintenanceError) {
    console.error("[CRON-SCHEDULER] Error during maintenance tasks:", maintenanceError);
  }

  const jobResult = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
    { status: 'QUEUED' },
    { $set: { status: 'PROCESSING', startedAt: new Date() } },
    { returnDocument: 'after', sort: { createdAt: 1 } }
  );

  const job = jobResult.value;
  if (!job) {
    console.log(`[CRON-SCHEDULER] No queued broadcast jobs found to process.`);
    return { message: "No queued broadcast jobs found.", error: null };
  }

  try {
    const result = await processSingleJob(db, job);
    console.log(`[CRON-SCHEDULER] Finished job ${job._id}: Sent ${result.successCount}, Failed ${result.errorCount}`);
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
