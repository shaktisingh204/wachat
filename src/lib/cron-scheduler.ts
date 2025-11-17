// cronScheduler.ts
'use strict';
require('dotenv').config();

import { connectToDatabase } from '../lib/mongodb.js';
import { Kafka, Partitioners } from 'kafkajs';
import { ObjectId } from 'mongodb';
import { getErrorMessage } from '../lib/utils.js';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(',');
const LOW_PRIORITY_TOPIC = 'low-priority-broadcasts';
const HIGH_PRIORITY_TOPIC = 'high-priority-broadcasts';
const MAX_BATCH_CONTACTS = 100; // contacts per Kafka message
const STUCK_JOB_TIMEOUT_MINUTES = 10;

async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
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
}

// Reset stuck jobs
async function resetStuckJobs(db) {
  const tenMinutesAgo = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
  const result = await db.collection('broadcasts').updateMany(
    { status: 'PROCESSING', startedAt: { $lt: tenMinutesAgo } },
    { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast job(s).`);
  }
}

// Queue contacts to Kafka
async function processSingleJob(db, job) {
  const broadcastId = job._id;
  const projectId = job.projectId;

  await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Scheduler picked up job ${broadcastId} for processing.`);

  const contacts = await db.collection('broadcast_contacts').find({ broadcastId, status: 'PENDING' }).toArray();
  if (!contacts.length) {
    const jobState = await db.collection('broadcasts').findOne({ _id: broadcastId });
    if(jobState && (jobState.successCount + jobState.errorCount) >= jobState.contactCount) {
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
    return;
  }

  const KAFKA_TOPIC = contacts.length > 5000 ? HIGH_PRIORITY_TOPIC : LOW_PRIORITY_TOPIC;
  const kafka = new Kafka({ clientId: `broadcast-producer-${broadcastId}`, brokers: KAFKA_BROKERS });
  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  await producer.connect();

  for (let i = 0; i < contacts.length; i += MAX_BATCH_CONTACTS) {
    const batch = contacts.slice(i, i + MAX_BATCH_CONTACTS);
    await producer.send({
      topic: KAFKA_TOPIC,
      messages: [{ value: JSON.stringify({ jobDetails: job, contacts: batch }) }],
    });
  }

  await producer.disconnect();
  const msg = `Queued ${contacts.length} contacts for job ${broadcastId}`;
  console.log(`[CRON-SCHEDULER] ${msg}`);
  await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
}

export async function processBroadcastJob() {
  console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);

  let db;
  try {
    const conn = await connectToDatabase();
    db = conn.db;
  } catch (dbError) {
    console.error('[CRON-SCHEDULER] Database connection failed:', getErrorMessage(dbError));
    return;
  }

  try {
    await resetStuckJobs(db);
  } catch (err) {
    console.error('[CRON-SCHEDULER] Maintenance error:', getErrorMessage(err));
  }

  const jobResult = await db.collection('broadcasts').findOneAndUpdate(
    { status: 'QUEUED' },
    { $set: { status: 'PROCESSING', startedAt: new Date() } },
    { returnDocument: 'after', sort: { createdAt: 1 } }
  );

  const job = jobResult.value;
  if (!job) {
    console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
    return;
  }

  processSingleJob(db, job).catch(err => {
    console.error(`[CRON-SCHEDULER] Unhandled error in job ${job._id}:`, getErrorMessage(err));
  });

  console.log(`[CRON-SCHEDULER] Job ${job._id} picked up and is being processed.`);
}
