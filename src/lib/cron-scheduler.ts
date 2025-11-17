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
const SEND_MESSAGE_GROUP = 20; // how many kafka messages to send in one producer.send call (keeps payloads reasonable)

/** Helper: safe convert to ObjectId if needed */
function toObjectId(maybeId: any): ObjectId {
  try {
    if (!maybeId) throw new Error('missing id');
    return maybeId instanceof ObjectId ? maybeId : new ObjectId(String(maybeId));
  } catch {
    return new ObjectId(String(maybeId));
  }
}

/** Writes an entry to broadcast_logs (best-effort). */
async function addBroadcastLog(db: Db, broadcastId: ObjectId | string, projectId: ObjectId | string, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta: object = {}) {
  try {
    if (!db || !broadcastId || !projectId) {
      console.error(`[CRON-SCHEDULER] Log attempt failed: Missing db, broadcastId, or projectId.`);
      return;
    }
    await db.collection('broadcast_logs').insertOne({
      broadcastId: toObjectId(broadcastId),
      projectId: toObjectId(projectId),
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  } catch (e) {
    // never throw from logger
    console.error(`[CRON-SCHEDULER] Failed to write log for job ${String(broadcastId)}:`, e);
  }
}

/** Reset stuck jobs which were PROCESSING for too long */
async function resetStuckJobs(db: Db) {
  const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
  const result = await db.collection<BroadcastJob>('broadcasts').updateMany(
    { status: 'PROCESSING', startedAt: { $lt: timeout } },
    { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast jobs.`);
  }
}

/** Create a JSON-serializable copy of the job (convert ObjectIds to strings) */
function sanitizeJobForKafka(job: any) {
  if (!job) return null;
  const copy = JSON.parse(JSON.stringify(job));
  try {
    if (job._id) copy._id = String(job._id);
    if (job.projectId) copy.projectId = String(job.projectId);
    // convert Date objects to ISO strings if present
    if (job.createdAt) copy.createdAt = (job.createdAt instanceof Date) ? job.createdAt.toISOString() : job.createdAt;
    if (job.startedAt) copy.startedAt = (job.startedAt instanceof Date) ? job.startedAt.toISOString() : job.startedAt;
  } catch (e) {
    // fallthrough
  }
  return copy;
}

/**
 * Process a single queued job: read PENDING contacts and push them to Kafka in batches.
 * This function runs in background (non-blocking from HTTP endpoint).
 */
async function processSingleJob(db: Db, job: WithId<BroadcastJob>) {
  const broadcastId = toObjectId(job._id);
  const projectId = toObjectId(job.projectId);

  await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Picked up job ${String(broadcastId)} for processing.`);

  // Only select fields needed for sending to Kafka to keep payload small
  const contacts = await db.collection('broadcast_contacts')
    .find({ broadcastId: broadcastId, status: 'PENDING' })
    .project({ _id: 1, phone: 1, variables: 1 })
    .toArray();

  if (!contacts.length) {
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job has no pending contacts to queue. A worker will finalize it.`);
    console.log(`[SCHEDULER] Job ${String(broadcastId)}: no pending contacts.`);
    return;
  }

  const kafka = new Kafka({
    clientId: `broadcast-producer-${String(broadcastId)}`,
    brokers: KAFKA_BROKERS,
    connectionTimeout: 5000,
    requestTimeout: 60000,
  });

  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    idempotent: true,
    maxInFlightRequests: 1,
  });

  const sanitizedJob = sanitizeJobForKafka(job);
  if (!sanitizedJob) throw new Error('Failed to sanitize job for Kafka.');

  try {
    await producer.connect();
    let totalQueued = 0;

    // Build kafka messages in batches sized by MAX_CONTACTS_PER_KAFKA_MESSAGE,
    // but send them in groups of SEND_MESSAGE_GROUP to avoid too many network calls.
    const kafkaMessages: Array<{ value: string }> = [];

    for (let i = 0; i < contacts.length; i += MAX_CONTACTS_PER_KAFKA_MESSAGE) {
      const slice = contacts.slice(i, i + MAX_CONTACTS_PER_KAFKA_MESSAGE);
      // convert ObjectId to string for each contact._id
      const safeContacts = slice.map(c => ({
        _id: String(c._id),
        phone: c.phone,
        variables: c.variables || {},
      }));

      const payload = {
        jobDetails: sanitizedJob,
        contacts: safeContacts
      };

      kafkaMessages.push({ value: JSON.stringify(payload) });
      totalQueued += safeContacts.length;

      // When we have enough messages, flush them
      if (kafkaMessages.length >= SEND_MESSAGE_GROUP) {
        await producer.send({ topic: KAFKA_TOPIC, messages: kafkaMessages.splice(0) });
      }
    }

    // send remaining messages if any
    if (kafkaMessages.length > 0) {
      await producer.send({ topic: KAFKA_TOPIC, messages: kafkaMessages });
    }

    const msg = `[SCHEDULER] Queued ${totalQueued}/${contacts.length} contacts for job ${String(broadcastId)} to topic '${KAFKA_TOPIC}'.`;
    console.log(msg);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);

  } catch (err) {
    const errorMsg = getErrorMessage(err);
    console.error(`[CRON-SCHEDULER] Job ${String(broadcastId)} failed to queue:`, errorMsg);
    await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
    // Reset the job to QUEUED to allow retry
    try {
      await db.collection('broadcasts').updateOne(
        { _id: broadcastId, status: 'PROCESSING' },
        { $set: { status: 'QUEUED', lastError: errorMsg }, $unset: { startedAt: '' } }
      );
    } catch (uErr) {
      console.error(`[CRON-SCHEDULER] Failed to revert job ${String(broadcastId)} status:`, getErrorMessage(uErr));
    }
  } finally {
    try { await producer.disconnect(); } catch (e) { /* ignore disconnect errors */ }
  }
}

/**
 * Main cron entry: picks one queued job and starts background processing.
 * Returns JSON-safe message; ensures job id string is used in response.
 */
export async function processBroadcastJob() {
  console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);

  let db: Db;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err: any) {
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
    // **CRITICAL FIX**: correctly extract the returned document
    jobDoc = result?.value ?? null;
  } catch (e) {
    const errorMsg = getErrorMessage(e);
    console.error(`[CRON-SCHEDULER] DB Error finding job: ${errorMsg}`);
    return { error: `DB Error: ${errorMsg}` };
  }

  if (!jobDoc) {
    console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
    return { message: 'No queued jobs found.' };
  }

  // Start background processing (do not await) and return JSON-serializable message
  processSingleJob(db, jobDoc).catch(err => {
    console.error(`[CRON-SCHEDULER] Unhandled exception in background job processing for ${String(jobDoc?._id)}:`, getErrorMessage(err));
  });

  return { message: `Job ${String(jobDoc._id)} picked up for processing.` };
}
