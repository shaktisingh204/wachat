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

function safeId(id: any): ObjectId {
  try {
    return id instanceof ObjectId ? id : new ObjectId(String(id));
  } catch {
    return new ObjectId();
  }
}

async function safeLog(
  db: Db, 
  broadcastId: any, 
  projectId: any, 
  level: 'INFO' | 'ERROR' | 'WARN',
  message: string,
  meta: object = {}
) {
  try {
    if (!db) return;

    if (!broadcastId || !projectId) {
      console.warn("[CRON-SCHEDULER] Log skipped: missing ids.");
      return;
    }

    await db.collection('broadcast_logs').insertOne({
      broadcastId: safeId(broadcastId),
      projectId: safeId(projectId),
      level,
      message,
      meta,
      timestamp: new Date(),
    });

  } catch (err) {
    console.error("[CRON-SCHEDULER] Log failed:", err);
  }
}

async function resetStuckJobs(db: Db) {
  const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60_000);
  const result = await db.collection('broadcasts').updateMany(
    { status: 'PROCESSING', startedAt: { $lt: timeout } },
    { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } }
  );

  if (result.modifiedCount > 0) {
    console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck jobs.`);
  }
}

function sanitizeJob(job: any) {
  try {
    const copy = JSON.parse(JSON.stringify(job));
    if (copy?._id) copy._id = String(copy._id);
    if (copy?.projectId) copy.projectId = String(copy.projectId);
    return copy;
  } catch {
    return null;
  }
}

async function queueJobContacts(db: Db, job: WithId<BroadcastJob>) {
  const broadcastId = safeId(job._id);
  const projectId = safeId(job.projectId);

  await safeLog(db, broadcastId, projectId, 'INFO', `Job ${broadcastId} picked for processing`);

  const contacts = await db.collection('broadcast_contacts')
    .find({ broadcastId, status: 'PENDING' })
    .project({ _id: 1, phone: 1, variables: 1 })
    .toArray();

  if (!contacts.length) {
    await safeLog(db, broadcastId, projectId, 'INFO', `No PENDING contacts.`);
    return;
  }

  const kafka = new Kafka({ clientId: `producer-${broadcastId}`, brokers: KAFKA_BROKERS });

  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    idempotent: true,
    maxInFlightRequests: 1,
  });

  const sanitizedJob = sanitizeJob(job);
  if (!sanitizedJob) throw new Error("Sanitize failed.");

  try {
    await producer.connect();

    let total = 0;
    const messages = [];

    for (let i = 0; i < contacts.length; i += MAX_CONTACTS_PER_KAFKA_MESSAGE) {
      const batch = contacts.slice(i, i + MAX_CONTACTS_PER_KAFKA_MESSAGE)
        .map(c => ({ _id: String(c._id), phone: c.phone, variables: c.variables || {} }));

      messages.push({ value: JSON.stringify({ jobDetails: sanitizedJob, contacts: batch }) });
      total += batch.length;
    }

    await producer.send({ topic: KAFKA_TOPIC, messages });

    await safeLog(db, broadcastId, projectId, 'INFO', `Queued ${total} contacts.`);

  } catch (err) {
    const errorMsg = getErrorMessage(err);
    await safeLog(db, broadcastId, projectId, 'ERROR', `Queue failed: ${errorMsg}`);
    await db.collection('broadcasts').updateOne(
      { _id: broadcastId },
      { $set: { status: 'QUEUED', lastError: errorMsg }, $unset: { startedAt: "" } }
    );
  } finally {
    await producer.disconnect().catch(() => {});
  }
}

export async function processBroadcastJob() {
  console.log(`[CRON] Begin at ${new Date().toISOString()}`);

  let db: Db;
  try {
    db = (await connectToDatabase()).db;
  } catch (err) {
    return { error: "DB connection failed" };
  }

  await resetStuckJobs(db);

  let jobDoc: WithId<BroadcastJob> | null = null;

  try {
    const res = await db.collection('broadcasts').findOneAndUpdate(
      { status: 'QUEUED' },
      { $set: { status: 'PROCESSING', startedAt: new Date() } },
      { returnDocument: 'after', sort: { createdAt: 1 } }
    );

    jobDoc = res?.value || null;

  } catch (err) {
    return { error: getErrorMessage(err) };
  }

  if (!jobDoc) {
    return { message: "No queued jobs found." };
  }

  queueJobContacts(db, jobDoc).catch(err =>
    console.error("Background error:", err)
  );

  return { message: `Job ${String(jobDoc._id)} picked up for processing.` };
}
