
'use strict';

import { connectToDatabase } from './mongodb';
import { Kafka, Partitioners, Producer } from 'kafkajs';
import { ObjectId, type Db, type WithId } from 'mongodb';
import { getErrorMessage } from './utils';
import type { BroadcastJob } from './definitions';

const KAFKA_TOPIC = 'broadcasts';
const MAX_KAFKA_MESSAGE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_CONTACTS_PER_KAFKA_MESSAGE = 500;
const STUCK_JOB_TIMEOUT_MINUTES = 10;
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];

async function addBroadcastLog(db: Db, broadcastId: ObjectId | string, projectId: ObjectId | string, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta = {}) {
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
        console.error(`[CRON-SCHEDULER] CRITICAL: Failed to write log for job ${String(broadcastId)}:`, e);
    }
}

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

function sanitizeForKafka(job: any): object | null {
    if (!job) return null;
    const sanitizedJob = JSON.parse(JSON.stringify(job));
    return sanitizedJob;
}

async function processSingleJob(db: Db, job: WithId<BroadcastJob>, kafkaProducer: Producer) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job ${broadcastId} picked up for processing.`);

    const contactsCursor = db.collection('broadcast_contacts').find({ 
        broadcastId: broadcastId, 
        status: 'PENDING' 
    }).project({ _id: 1, phone: 1, variables: 1 });

    const jobDetails = sanitizeForKafka(job);
    if (!jobDetails) {
        throw new Error(`Failed to serialize job details for Kafka (Job ID: ${broadcastId}).`);
    }

    let totalQueued = 0;
    let batch = [];
    
    for await (const contact of contactsCursor) {
        batch.push(contact);
        if (batch.length >= MAX_CONTACTS_PER_KAFKA_MESSAGE) {
            await kafkaProducer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify({ jobDetails, contacts: batch }) }],
            });
            totalQueued += batch.length;
            batch = [];
        }
    }
    
    if (batch.length > 0) {
        await kafkaProducer.send({
            topic: KAFKA_TOPIC,
            messages: [{ value: JSON.stringify({ jobDetails, contacts: batch }) }],
        });
        totalQueued += batch.length;
    }

    if (totalQueued > 0) {
        const msg = `[SCHEDULER] Queued ${totalQueued} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
        console.log(msg);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
    } else {
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job has no pending contacts to queue. Workers will finalize completion.`);
    }
}

export async function processBroadcastJob() {
    console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);

    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.error('[CRON-SCHEDULER] DB connection failed:', errorMessage);
        return { error: 'Database connection failed' };
    }

    try {
        await resetStuckJobs(db);
    } catch (err) {
        console.error('[CRON-SCHEDULER] Error resetting jobs:', getErrorMessage(err));
    }
    
    // Find and atomically update one job to 'PROCESSING' state
    const result = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
    );
    
    const job = result;

    if (!job) {
        console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }

    const kafka = new Kafka({ clientId: 'broadcast-producer', brokers: KAFKA_BROKERS });
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

    try {
        await producer.connect();
        await processSingleJob(db, job, producer);
    } catch (err: any) {
        const errorMsg = getErrorMessage(err);
        console.error(`[CRON-SCHEDULER] Failed to process job ${job._id}:`, errorMsg);
        await addBroadcastLog(db, job._id, job.projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
        await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } });
        return { error: `Failed to process job: ${errorMsg}` };
    } finally {
        await producer.disconnect().catch(e => console.error("Failed to disconnect Kafka producer", e));
    }
    
    return { message: `Job ${job._id} picked up and contacts queued successfully.` };
}
