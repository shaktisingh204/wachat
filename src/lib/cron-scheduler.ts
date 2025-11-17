
'use strict';

import { connectToDatabase } from './mongodb';
import { Kafka, Partitioners } from 'kafkajs';
import { ObjectId, type Db, type WithId } from 'mongodb';
import { getErrorMessage } from './utils';
import type { BroadcastJob } from './definitions';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const KAFKA_TOPIC = 'broadcasts';
const MAX_CONTACTS_PER_KAFKA_MESSAGE = 500;
const STUCK_JOB_TIMEOUT_MINUTES = 10;

/**
 * Logs a message to the dedicated broadcast log collection in MongoDB.
 */
async function addBroadcastLog(db: Db, broadcastId: any, projectId: any, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta: object = {}) {
  try {
    if (!db || !broadcastId || !projectId) {
      console.error(`[CRON-SCHEDULER] Log attempt failed: Missing db, broadcastId, or projectId.`);
      return;
    };
    await db.collection('broadcast_logs').insertOne({
      broadcastId: new ObjectId(String(broadcastId)),
      projectId: new ObjectId(String(projectId)),
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error(`[CRON-SCHEDULER] Failed to write log for job ${String(broadcastId)}:`, e);
  }
}

/**
 * Resets jobs stuck in the 'PROCESSING' state for too long.
 */
async function resetStuckJobs(db: Db) {
  const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
  const result = await db.collection('broadcasts').updateMany(
    { status: 'PROCESSING', startedAt: { $lt: timeout } },
    { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast jobs.`);
  }
}

/**
 * Creates a JSON-safe version of the job object for Kafka.
 */
function sanitizeJobForKafka(job: any) {
    if (!job) return null;
    const copy = JSON.parse(JSON.stringify(job));

    const sanitizeNested = (obj: any) => {
        for (const key in obj) {
            if (obj[key] instanceof ObjectId) {
                obj[key] = obj[key].toString();
            } else if (obj[key] instanceof Date) {
                obj[key] = obj[key].toISOString();
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeNested(obj[key]);
            }
        }
    };
    sanitizeNested(copy);
    return copy;
}

/**
 * Fetches contacts for a job and pushes them in batches to Kafka.
 */
async function processSingleJob(db: Db, job: WithId<BroadcastJob>) {
  const broadcastId = job._id;
  const projectId = job.projectId;

  await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Picked up job ${broadcastId} for processing.`);

  const contacts = await db
    .collection('broadcast_contacts')
    .find({ broadcastId: new ObjectId(broadcastId), status: 'PENDING' })
    .project({ _id: 1, phone: 1, variables: 1 })
    .toArray();

  if (contacts.length === 0) {
    const finalJobState = await db.collection('broadcasts').findOne({ _id: broadcastId });
    if (finalJobState && (finalJobState.successCount || 0) + (finalJobState.errorCount || 0) >= finalJobState.contactCount) {
        await db.collection('broadcasts').updateOne(
            { _id: broadcastId, status: 'PROCESSING' },
            { $set: { status: 'Completed', completedAt: new Date() } }
        );
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Finalizing job with no pending contacts.`);
    } else {
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] No pending contacts to queue. Worker will finalize if needed.`);
    }
    return;
  }

  const kafka = new Kafka({
    clientId: `broadcast-producer-${broadcastId.toString()}`,
    brokers: KAFKA_BROKERS,
    connectionTimeout: 5000,
    requestTimeout: 30000,
  });

  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    idempotent: true,
  });
  
  const sanitizedJobDetails = sanitizeJobForKafka(job);
  if (!sanitizedJobDetails) {
    throw new Error(`Job ${broadcastId} failed to serialize for Kafka.`);
  }

  try {
    await producer.connect();
    let totalQueued = 0;
    const messages = [];

    for (let i = 0; i < contacts.length; i += MAX_CONTACTS_PER_KAFKA_MESSAGE) {
      const batch = contacts.slice(i, i + MAX_CONTACTS_PER_KAFKA_MESSAGE);
      messages.push({ 
        value: JSON.stringify({ 
          jobDetails: sanitizedJobDetails, 
          contacts: batch.map(c => ({
              _id: c._id.toString(),
              phone: c.phone,
              variables: c.variables || {}
          })),
        }) 
      });
      totalQueued += batch.length;
    }

    if (messages.length > 0) {
        await producer.send({ topic: KAFKA_TOPIC, messages });
    }

    const msg = `[CRON-SCHEDULER] Queued ${totalQueued}/${contacts.length} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
    console.log(msg);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
  } catch (err) {
    const errorMsg = getErrorMessage(err);
    console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed to queue:`, errorMsg);
    await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
    await db.collection('broadcasts').updateOne(
      { _id: broadcastId, status: 'PROCESSING' },
      { $set: { status: 'QUEUED', lastError: errorMsg }, $unset: { startedAt: '' } }
    );
  } finally {
    await producer.disconnect();
  }
}

/**
 * Main function for the cron job. Finds and processes one queued broadcast job.
 */
export async function processBroadcastJob() {
  console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);

  let db: Db;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    console.error('[CRON-SCHEDULER] DB connection failed:', getErrorMessage(err));
    return { error: 'DB connection failed' };
  }

  try { await resetStuckJobs(db); } catch (err) { console.error('[CRON-SCHEDULER] Error resetting jobs:', getErrorMessage(err)); }

  let jobDoc: WithId<BroadcastJob> | null = null;
  try {
    const result = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
      );
      
    // CORRECTLY ACCESS THE DOCUMENT FROM THE `value` PROPERTY
    jobDoc = result;
      
  } catch (err) {
    console.error('[CRON-SCHEDULER] findOneAndUpdate failed:', getErrorMessage(err));
    return { message: getErrorMessage(err) };
  }
  
  if (!jobDoc) {
    console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
    return { message: 'No queued jobs found.' };
  }

  // Run the job processing in the background; don't await.
  processSingleJob(db, jobDoc).catch(err => {
    console.error(`[CRON-SCHEDULER] Unhandled error in background job processing for ${String(jobDoc?._id)}:`, getErrorMessage(err));
  });

  return { message: `Job ${jobDoc?._id?.toString()} picked up for processing.` };
}
