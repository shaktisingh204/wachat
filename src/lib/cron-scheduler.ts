
'use strict';

import { connectToDatabase } from './mongodb';
import { Kafka, Partitioners } from 'kafkajs';
import { ObjectId, type Db } from 'mongodb';
import { getErrorMessage } from './utils';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const KAFKA_TOPIC = 'broadcasts';
const MAX_CONTACTS_PER_KAFKA_MESSAGE = 500; // Optimal batch size for a single Kafka message
const STUCK_JOB_TIMEOUT_MINUTES = 10;

/**
 * Logs a message to the broadcast log collection.
 */
async function addBroadcastLog(db: Db, broadcastId: ObjectId, projectId: ObjectId, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta = {}) {
    try {
        if (!db || !broadcastId || !projectId) {
            console.error(`[CRON-SCHEDULER] Log attempt failed: Missing required IDs.`);
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
        console.error(`[CRON-SCHEDULER] Failed to write log for job ${broadcastId}:`, e);
    }
}

/**
 * Finds and resets broadcast jobs that have been stuck in the 'PROCESSING' state for too long.
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
 * Sanitizes a MongoDB document for safe Kafka serialization.
 */
function sanitizeForKafka(job: any): object | null {
    if (!job) return null;
    const sanitizedJob = JSON.parse(JSON.stringify(job));
    return sanitizedJob;
}

/**
 * Fetches pending contacts for a job and pushes them in batches to Kafka.
 */
async function processSingleJob(db: Db, job: any) {
    const broadcastId = new ObjectId(job._id);
    const projectId = new ObjectId(job.projectId);

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Picked up job ${broadcastId} for processing.`);

    const contactsCursor = db.collection('broadcast_contacts').find({ 
        broadcastId: broadcastId, 
        status: 'PENDING' 
    }).project({ _id: 1, phone: 1, variables: 1 });

    const kafka = new Kafka({
        clientId: `broadcast-producer-${broadcastId}`,
        brokers: KAFKA_BROKERS,
        connectionTimeout: 5000,
        requestTimeout: 30000,
    });
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    
    const sanitizedJobDetails = sanitizeForKafka(job);
    if (!sanitizedJobDetails) throw new Error("Failed to serialize job details for Kafka.");

    let totalQueued = 0;
    try {
        await producer.connect();
        let batch = [];
        for await (const contact of contactsCursor) {
            batch.push(contact);
            if (batch.length >= MAX_CONTACTS_PER_KAFKA_MESSAGE) {
                await producer.send({ topic: KAFKA_TOPIC, messages: [{ value: JSON.stringify({ jobDetails: sanitizedJobDetails, contacts: batch }) }] });
                totalQueued += batch.length;
                batch = [];
            }
        }
        if (batch.length > 0) {
            await producer.send({ topic: KAFKA_TOPIC, messages: [{ value: JSON.stringify({ jobDetails: sanitizedJobDetails, contacts: batch }) }] });
            totalQueued += batch.length;
        }

        const msg = `[SCHEDULER] Queued ${totalQueued} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
        console.log(msg);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);

    } catch (err: any) {
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

    let db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (err: any) {
        console.error('[CRON-SCHEDULER] DB connection failed:', getErrorMessage(err));
        return { error: 'DB connection failed' };
    }

    try { await resetStuckJobs(db); } catch (err) { console.error('[CRON-SCHEDULER] Error resetting jobs:', getErrorMessage(err)); }

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
    
    // Process the job in the background without awaiting
    processSingleJob(db, job).catch(err => {
        console.error(`[CRON-SCHEDULER] Unhandled error in background job processing for ${job._id}:`, getErrorMessage(err));
    });

    return { message: `Job ${job._id} picked up for processing.` };
}
