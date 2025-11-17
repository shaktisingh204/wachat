
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

async function addBroadcastLog(db: Db, broadcastId: ObjectId | string, projectId: ObjectId | string, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta = {}) {
    try {
        if (!db || !broadcastId || !projectId) return;
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

async function processJob(db: Db, job: WithId<BroadcastJob>) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job ${broadcastId} picked up for processing.`);

    const contactsCursor = db.collection('broadcast_contacts').find({ 
        broadcastId: broadcastId, 
        status: 'PENDING' 
    }).project({ _id: 1, phone: 1, variables: 1 });

    const kafka = new Kafka({
        clientId: `broadcast-producer-${broadcastId.toString()}`,
        brokers: KAFKA_BROKERS,
    });
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

    try {
        await producer.connect();
        
        const jobDetails = sanitizeForKafka(job);
        if (!jobDetails) throw new Error("Failed to serialize job details for Kafka.");

        let totalQueued = 0;
        let hasContacts = false;
        let batch = [];

        for await (const contact of contactsCursor) {
            hasContacts = true;
            batch.push(contact);
            if (batch.length >= MAX_CONTACTS_PER_KAFKA_MESSAGE) {
                await producer.send({
                    topic: KAFKA_TOPIC,
                    messages: [{ value: JSON.stringify({ jobDetails, contacts: batch }) }],
                });
                totalQueued += batch.length;
                batch = [];
            }
        }
        
        if (batch.length > 0) {
            await producer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify({ jobDetails, contacts: batch }) }],
            });
            totalQueued += batch.length;
        }

        if (!hasContacts) {
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job has no pending contacts. It will be finalized by a worker.`);
        } else {
             const msg = `[SCHEDULER] Queued a total of ${totalQueued} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
             console.log(msg);
             await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
        }

    } catch (err: any) {
        const errorMsg = getErrorMessage(err);
        console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed to queue:`, errorMsg);
        await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
        await db.collection('broadcasts').updateOne({ _id: broadcastId }, { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } });
    } finally {
        await producer.disconnect().catch(e => console.error("Failed to disconnect producer", e));
    }
}

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
    
    processJob(db, job).catch(err => {
        console.error(`[CRON-SCHEDULER] Unhandled error in background job processing for ${job._id}:`, getErrorMessage(err));
    });

    return { message: `Job ${job._id} picked up for processing.` };
}
