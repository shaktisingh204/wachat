
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
 * This is a critical utility for debugging and monitoring the broadcast process.
 */
async function addBroadcastLog(db: Db, broadcastId: ObjectId, projectId: ObjectId, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta: object = {}) {
    try {
        if (!db || !broadcastId || !projectId) {
            console.error(`[CRON-SCHEDULER] Log attempt failed: Missing db, broadcastId, or projectId.`);
            return;
        };
        await db.collection('broadcast_logs').insertOne({
            broadcastId: new ObjectId(broadcastId),
            projectId: new ObjectId(projectId),
            level,
            message,
            meta,
            timestamp: new Date(),
        });
    } catch (e) {
        console.error(`[CRON-SCHEDULER] CRITICAL: Failed to write log for job ${broadcastId}:`, e);
    }
}

/**
 * Finds and resets broadcast jobs that have been stuck in the 'PROCESSING' state for too long.
 * This is a safeguard against worker crashes or unexpected interruptions.
 */
async function resetStuckJobs(db: Db) {
    const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
    const result = await db.collection<BroadcastJob>('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: timeout } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
    );
    if (result.modifiedCount > 0) {
        console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast jobs.`);
        // Note: A system-level log event could be added here if needed.
    }
}

/**
 * Creates a plain, JSON-serializable object from a MongoDB document.
 * This is essential for safely sending job details to Kafka without serialization errors.
 */
function sanitizeForKafka(job: any): object | null {
    if (!job) return null;
    try {
        // This creates a deep copy and converts complex types to their string/ISO representations.
        return JSON.parse(JSON.stringify(job));
    } catch (error) {
        console.error("[CRON-SCHEDULER] Failed to serialize job details for Kafka", error);
        return null;
    }
}

/**
 * Fetches all pending contacts for a job and pushes them in batches to Kafka.
 * This function runs in the background and does not block the main API response.
 */
async function processSingleJob(db: Db, job: WithId<BroadcastJob>) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Picked up job ${broadcastId} for processing.`);

    const contacts = await db.collection('broadcast_contacts').find({ 
        broadcastId: broadcastId, 
        status: 'PENDING' 
    }).project({ _id: 1, phone: 1, variables: 1 }).toArray();

    if (contacts.length === 0) {
        // No pending contacts. The worker will handle job completion.
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job has no pending contacts to queue. A worker will finalize it.`);
        return;
    }

    const kafka = new Kafka({
        clientId: `broadcast-producer-${broadcastId.toString()}`,
        brokers: KAFKA_BROKERS,
        connectionTimeout: 5000,
        requestTimeout: 60000, // Increased for potentially large send operations
    });

    const producer = kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
        idempotent: true, // Ensures messages are written exactly once
        maxInFlightRequests: 1 // Ensures message order on retry
    });
    
    const sanitizedJobDetails = sanitizeForKafka(job);
    if (!sanitizedJobDetails) {
        throw new Error("Failed to serialize job details for Kafka.");
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
                    contacts: batch 
                }) 
            });
            totalQueued += batch.length;
        }

        if (messages.length > 0) {
            await producer.send({
                topic: KAFKA_TOPIC,
                messages: messages,
            });
        }
        
        const msg = `[SCHEDULER] Queued ${totalQueued}/${contacts.length} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
        console.log(msg);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);

    } catch (err) {
        const errorMsg = getErrorMessage(err);
        console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed to queue:`, errorMsg);
        await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
        // Reset the job to QUEUED so it can be retried on the next cron run
        await db.collection('broadcasts').updateOne(
            { _id: broadcastId, status: 'PROCESSING' },
            { $set: { status: 'QUEUED', lastError: errorMsg }, $unset: { startedAt: '' } }
        );
    } finally {
        await producer.disconnect();
    }
}

/**
 * Main function for the cron job. Finds and processes ONE queued broadcast job.
 * This is designed to be called by an API route (e.g., /api/cron/send-broadcasts).
 */
export async function processBroadcastJob() {
    console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);

    let db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (err: any) {
        console.error('[CRON-SCHEDULER] DB connection failed:', getErrorMessage(err));
        return { error: 'DB connection failed' };
    }

    try { await resetStuckJobs(db); } catch (err) { console.error('[CRON-SCHEDULER] Error resetting jobs:', getErrorMessage(err)); }

    let job: WithId<BroadcastJob> | null = null;
    try {
        // Atomically find one queued job and mark it as processing.
        const findResult = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { returnDocument: 'after', sort: { createdAt: 1 } }
        );
        job = findResult;
    } catch (e) {
        const errorMsg = getErrorMessage(e);
        console.error(`[CRON-SCHEDULER] DB Error finding job: ${errorMsg}`);
        return { error: `DB Error: ${errorMsg}` };
    }
    
    if (!job) {
        console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }
    
    // Don't await this. Let it run in the background. The API route will return immediately.
    processSingleJob(db, job).catch(err => {
        console.error(`[CRON-SCHEDULER] Unhandled exception in background job processing for ${job?._id}:`, getErrorMessage(err));
    });

    return { message: `Job ${job._id} picked up for processing.` };
}
