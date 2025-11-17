
'use strict';

import { connectToDatabase } from './mongodb';
import { Kafka, Partitioners } from 'kafkajs';
import { ObjectId, type Db, type WithId } from 'mongodb';
import { getErrorMessage } from './utils';
import type { BroadcastJob } from './definitions';

const KAFKA_TOPIC = 'broadcasts';
const MAX_CONTACTS_PER_KAFKA_MESSAGE = 500;
const STUCK_JOB_TIMEOUT_MINUTES = 10;
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const MAX_KAFKA_MESSAGE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Logs a message to the broadcast log collection.
 */
async function addBroadcastLog(db: Db, broadcastId: ObjectId | string, projectId: ObjectId | string, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta = {}) {
    try {
        if (!db || !broadcastId || !projectId) {
            console.error(`[CRON-SCHEDULER] Log attempt failed: Missing critical IDs.`);
            return;
        }
        await db.collection('broadcast_logs').insertOne({
            broadcastId: new ObjectId(broadcastId),
            projectId: new ObjectId(projectId),
            level,
            message,
            meta,
            timestamp: new Date(),
        });
    } catch (e) {
        console.error(`[CRON-SCHEDULER] CRITICAL: Failed to write log for job ${String(broadcastId)}:`, e);
    }
}

/**
 * Finds and resets jobs that have been stuck in the 'PROCESSING' state for too long.
 */
async function resetStuckJobs(db: Db) {
    const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
    const result = await db.collection('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: timeout } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } }
    );
    if (result.modifiedCount > 0) {
        console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast jobs.`);
    }
}

/**
 * Creates a Kafka-safe, serializable version of the job object.
 */
function sanitizeForKafka(job: any): object | null {
    if (!job) return null;
    const sanitizedJob = { ...job };
    for (const key in sanitizedJob) {
        if (sanitizedJob[key] instanceof ObjectId) {
            sanitizedJob[key] = sanitizedJob[key].toString();
        } else if (sanitizedJob[key] instanceof Date) {
            sanitizedJob[key] = sanitizedJob[key].toISOString();
        }
    }
    return sanitizedJob;
}

/**
 * Fetches pending contacts for a job and pushes them in batches to Kafka.
 */
async function processJob(db: Db, job: WithId<BroadcastJob>) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job ${broadcastId} picked up for processing.`);

    const contacts = await db.collection('broadcast_contacts').find({ 
        broadcastId: broadcastId, 
        status: 'PENDING' 
    }).project({ _id: 1, phone: 1, variables: 1 }).toArray();

    if (contacts.length === 0) {
        const finalJobState = await db.collection('broadcasts').findOne({ _id: broadcastId });
        if (finalJobState && (finalJobState.successCount || 0) + (finalJobState.errorCount || 0) >= finalJobState.contactCount) {
             await db.collection('broadcasts').updateOne({ _id: broadcastId, status: 'PROCESSING' }, { $set: { status: 'Completed', completedAt: new Date() } });
             await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] No pending contacts found; job finalized as Completed.`);
        } else {
            await addBroadcastLog(db, broadcastId, projectId, 'WARN', `[SCHEDULER] Job has no pending contacts to queue, but is not yet complete. A worker will finalize it later.`);
        }
        return;
    }

    const kafka = new Kafka({
        clientId: `broadcast-producer-${broadcastId}`,
        brokers: KAFKA_BROKERS,
    });
    const producer = kafka.producer({ 
        idempotent: true, 
        maxInFlightRequests: 1, 
        transactionalId: `broadcast-tx-${broadcastId}` 
    });

    try {
        await producer.connect();
        
        const jobDetails = sanitizeForKafka(job);
        if (!jobDetails) throw new Error("Failed to serialize job details for Kafka.");

        let totalQueued = 0;
        const messages = [];

        for (let i = 0; i < contacts.length; i += MAX_CONTACTS_PER_KAFKA_MESSAGE) {
            const batch = contacts.slice(i, i + MAX_CONTACTS_PER_KAFKA_MESSAGE);
            messages.push({ 
                value: JSON.stringify({ 
                    jobDetails, 
                    contacts: batch.map(c => ({...c, _id: c._id.toString()}))
                }) 
            });
            totalQueued += batch.length;
        }

        await producer.send({ topic: KAFKA_TOPIC, messages });

        const msg = `[SCHEDULER] Queued ${totalQueued}/${contacts.length} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
        console.log(msg);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
    } catch (err: any) {
        const errorMsg = getErrorMessage(err);
        console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed to queue:`, errorMsg);
        await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
        await db.collection('broadcasts').updateOne(
            { _id: broadcastId, status: 'PROCESSING' },
            { $set: { status: 'QUEUED', lastError: errorMsg }, $unset: { startedAt: "" } }
        );
    } finally {
        await producer.disconnect().catch(e => console.error("Failed to disconnect producer", e));
    }
}

/**
 * Main cron function: finds and processes one queued broadcast job.
 */
export async function processBroadcastJob() {
    console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);

    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (err) {
        console.error('[CRON-SCHEDULER] DB connection failed:', getErrorMessage(err));
        return { error: 'Database connection failed' };
    }

    try {
        await resetStuckJobs(db);
    } catch (err) {
        console.error('[CRON-SCHEDULER] Error resetting jobs:', getErrorMessage(err));
    }

    const findResult = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
    );
    
    const job = findResult;
    if (!job) {
        console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }

    processJob(db, job).catch(err => {
        console.error(`[CRON-SCHEDULER] Unhandled error in background job processing for ${job._id}:`, getErrorMessage(err));
    });

    return { message: `Job ${job._id} picked up for processing.` };
}
