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
const SEND_MESSAGE_GROUP = 20;

/**
 * Convert anything to ObjectId safely.
 */
function toObjectId(id: any): ObjectId {
  try {
    if (!id) throw new Error('missing id');
    return id instanceof ObjectId ? id : new ObjectId(String(id));
  } catch {
    return new ObjectId(String(id));
  }
}

/**
 * Write log (silent fallback).
 */
async function addBroadcastLog(
  db: Db,
  broadcastId: any,
  projectId: any,
  level: 'INFO' | 'ERROR' | 'WARN',
  message: string,
  meta: object = {}
) {
  try {
    if (!db || !broadcastId || !projectId) return;
    await db.collection('broadcast_logs').insertOne({
      broadcastId: toObjectId(broadcastId),
      projectId: toObjectId(projectId),
      level,
      message,
      meta,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error(`[CRON] Failed to write log for ${String(broadcastId)}:`, e);
  }
}

/**
 * Reset jobs stuck in PROCESSING.
 */
async function resetStuckJobs(db: Db) {
  const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60_000);
  const result = await db.collection('broadcasts').updateMany(
    { status: 'PROCESSING', startedAt: { $lt: timeout } },
    { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
  );

  if (result.modifiedCount > 0) {
    console.log(`[CRON] Reset ${result.modifiedCount} stuck jobs.`);
  }
}

/**
 * Make job JSON-serializable.
 */
function sanitizeJobForKafka(job: any) {
  if (!job) return null;
  const copy = JSON.parse(JSON.stringify(job));

  try {
    if (job._id) copy._id = String(job._id);
    if (job.projectId) copy.projectId = String(job.projectId);

    if (job.createdAt instanceof Date)
      copy.createdAt = job.createdAt.toISOString();
    if (job.startedAt instanceof Date)
      copy.startedAt = job.startedAt.toISOString();
  } catch {}

  return copy;
}

/**
 * Core job processor: send contacts to Kafka.
 */
async function processSingleJob(db: Db, job: WithId<BroadcastJob>) {
  const broadcastId = toObjectId(job._id);
  const projectId = toObjectId(job.projectId);

  await addBroadcastLog(
    db,
    broadcastId,
    projectId,
    'INFO',
    `[CRON] Processing job ${broadcastId}`
  );

  const contacts = await db
    .collection('broadcast_contacts')
    .find({ broadcastId, status: 'PENDING' })
    .project({ _id: 1, phone: 1, variables: 1 })
    .toArray();

  if (contacts.length === 0) {
    await addBroadcastLog(
      db,
      broadcastId,
      projectId,
      'INFO',
      `[CRON] No pending contacts. Worker will finalize.`
    );
    return;
  }

  const kafka = new Kafka({
    clientId: `broadcast-producer-${broadcastId}`,
    brokers: KAFKA_BROKERS,
  });

  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    idempotent: true,
    maxInFlightRequests: 1,
  });

  const sanitizedJob = sanitizeJobForKafka(job);
  if (!sanitizedJob) throw new Error(`Job ${broadcastId} sanitize failed`);

  try {
    await producer.connect();

    let totalQueued = 0;
    const messageBuffer: any[] = [];

    for (let i = 0; i < contacts.length; i += MAX_CONTACTS_PER_KAFKA_MESSAGE) {
      const batch = contacts.slice(i, i + MAX_CONTACTS_PER_KAFKA_MESSAGE);

      const safeContacts = batch.map((c) => ({
        _id: String(c._id),
        phone: c.phone,
        variables: c.variables || {},
      }));

      const payload = {
        jobDetails: sanitizedJob,
        contacts: safeContacts,
      };

      messageBuffer.push({ value: JSON.stringify(payload) });
      totalQueued += safeContacts.length;

      if (messageBuffer.length >= SEND_MESSAGE_GROUP) {
        await producer.send({
          topic: KAFKA_TOPIC,
          messages: messageBuffer.splice(0),
        });
      }
    }

    if (messageBuffer.length) {
      await producer.send({ topic: KAFKA_TOPIC, messages: messageBuffer });
    }

    const msg = `[CRON] Queued ${totalQueued}/${contacts.length} contacts for job ${broadcastId}`;
    console.log(msg);
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
  } catch (err) {
    const errorMsg = getErrorMessage(err);

    await addBroadcastLog(
      db,
      broadcastId,
      projectId,
      'ERROR',
      `[CRON] Kafka send failed: ${errorMsg}`
    );

    await db.collection('broadcasts').updateOne(
      { _id: broadcastId },
      { $set: { status: 'QUEUED', lastError: errorMsg }, $unset: { startedAt: '' } }
    );
  } finally {
    try {
      await producer.disconnect();
    } catch {}
  }
}

/**
 * Main cron entry: pick ONE job.
 */
export async function processBroadcastJob() {
  console.log(`[CRON] Run @ ${new Date().toISOString()}`);

  let db: Db;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (err) {
    return { error: 'DB connection failed' };
  }

  await resetStuckJobs(db);

  let jobDoc: WithId<BroadcastJob> | null = null;

  try {
    const result = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
      );
      
      jobDoc = result?.value || null;
      
  } catch (err) {
    return { error: getErrorMessage(err) };
  }

  if (!jobDoc) {
    return { message: 'No queued jobs found.' };
  }

  // Background task
  processSingleJob(db, jobDoc).catch((err) => {
    console.error(
      `[CRON] Background error for job ${String(jobDoc?._id)}:`,
      err
    );
  });

  return { message: `Job ${String(jobDoc._id)} picked up for processing.` };
}
