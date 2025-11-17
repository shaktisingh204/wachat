
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

// Safety wrapper for logging
async function addBroadcastLog(db: Db, broadcastId: any, projectId: any, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta = {}) {
    try {
        if (!db || !broadcastId || !projectId) {
            console.error(`[CRON-SCHEDULER] Log attempt failed: Missing db, broadcastId, or projectId.`);
            return;
        }
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

// Resets jobs stuck in 'PROCESSING' state
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

// Prepares the job object for safe Kafka serialization
function sanitizeJobForKafka(job: any): object | null {
    if (!job) return null;
    // Create a serializable copy, converting ObjectIds and Dates to strings
    const sanitized = JSON.parse(JSON.stringify(job));
    return sanitized;
}

// Main cron function
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

    // Atomically find one 'QUEUED' job and mark it as 'PROCESSING'
    const findResult = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
    );

    const jobDoc = findResult;
    if (!jobDoc) {
        console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }

    const broadcastId = jobDoc._id;
    const projectId = jobDoc.projectId;
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Picked up job ${broadcastId} for processing.`);

    // Run the rest in the background without awaiting
    (async () => {
        let producer;
        try {
            const contacts = await db.collection('broadcast_contacts').find({
                broadcastId: broadcastId,
                status: 'PENDING'
            }).project({ _id: 1, phone: 1, variables: 1 }).toArray();

            if (contacts.length === 0) {
                await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] No pending contacts found for job. Worker will finalize.`);
                return;
            }

            const kafka = new Kafka({
                clientId: `broadcast-producer-${broadcastId}`,
                brokers: KAFKA_BROKERS,
            });
            producer = kafka.producer({
                idempotent: true,
                maxInFlightRequests: 1,
                transactionalId: `broadcast-tx-${broadcastId}`
            });
            await producer.connect();

            const sanitizedJobDetails = sanitizeJobForKafka(jobDoc);
            if (!sanitizedJobDetails) {
                throw new Error("Failed to serialize job details for Kafka.");
            }
            
            let totalQueued = 0;

            for (let i = 0; i < contacts.length; i += MAX_CONTACTS_PER_KAFKA_MESSAGE) {
                const batch = contacts.slice(i, i + MAX_CONTACTS_PER_KAFKA_MESSAGE);
                const kafkaMessage = {
                    topic: KAFKA_TOPIC,
                    messages: [{
                        value: JSON.stringify({
                            jobDetails: sanitizedJobDetails,
                            contacts: batch.map(c => ({
                                _id: String(c._id),
                                phone: c.phone,
                                variables: c.variables || {}
                            }))
                        })
                    }]
                };
                await producer.send(kafkaMessage);
                totalQueued += batch.length;
            }

            const msg = `[SCHEDULER] Queued ${totalQueued}/${contacts.length} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
            console.log(msg);
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            console.error(`[CRON-SCHEDULER] Job ${broadcastId} failed to queue:`, errorMsg);
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId, status: 'PROCESSING' },
                { $set: { status: 'QUEUED', lastError: errorMsg }, $unset: { startedAt: "" } }
            );
        } finally {
            if (producer) {
                await producer.disconnect().catch(e => console.error("Failed to disconnect producer", e));
            }
        }
    })();

    return { message: `Job ${jobDoc._id} picked up for processing.` };
}
