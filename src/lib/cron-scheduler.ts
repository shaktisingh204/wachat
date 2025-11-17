'use strict';

import { connectToDatabase } from './mongodb';
import { Kafka, Partitioners } from 'kafkajs';
import { ObjectId, type Db, type WithId } from 'mongodb';
import { getErrorMessage } from './utils';
import type { BroadcastJob } from './definitions';

const KAFKA_TOPIC = 'broadcasts';
const MAX_CONTACTS_PER_KAFKA_MESSAGE = 500;
const STUCK_JOB_TIMEOUT_MINUTES = 10;

/** Convert any id to ObjectId safely */
function oid(id: any): ObjectId {
    return id instanceof ObjectId ? id : new ObjectId(String(id));
}

/** Logging with all safety checks */
async function logSafe(
    db: Db | null,
    broadcastId: any,
    projectId: any,
    level: 'INFO' | 'ERROR' | 'WARN',
    message: string
) {
    try {
        if (!db) return;
        if (!broadcastId || !projectId) return; // Prevents your error
        await db.collection('broadcast_logs').insertOne({
            broadcastId: oid(broadcastId),
            projectId: oid(projectId),
            level,
            message,
            timestamp: new Date(),
        });
    } catch (err) {
        console.error("[CRON LOG ERROR]", err);
    }
}

/** Reset stuck jobs */
async function resetStuckJobs(db: Db) {
    const tenMinutesAgo = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60000);
    await db.collection('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: tenMinutesAgo } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } }
    );
}

/** Ensure job is JSON safe */
function sanitizeJob(job: any) {
    const copy = JSON.parse(JSON.stringify(job));
    copy._id = String(job._id);
    copy.projectId = String(job.projectId);
    return copy;
}

/** Process contacts and send to Kafka */
async function processJobContacts(db: Db, job: WithId<BroadcastJob>) {
    const broadcastId = oid(job._id);
    const projectId = oid(job.projectId);

    await logSafe(db, broadcastId, projectId, 'INFO', `Picked up job ${broadcastId}`);

    const contacts = await db.collection('broadcast_contacts')
        .find({ broadcastId, status: 'PENDING' })
        .project({ _id: 1, phone: 1, variables: 1 })
        .toArray();

    if (contacts.length === 0) {
        await logSafe(db, broadcastId, projectId, 'INFO', `No pending contacts.`);
        return;
    }

    const kafka = new Kafka({ brokers: (process.env.KAFKA_BROKERS || "").split(',') });
    const producer = kafka.producer({ idempotent: true, maxInFlightRequests: 1 });

    const jobData = sanitizeJob(job);

    try {
        await producer.connect();

        for (let i = 0; i < contacts.length; i += MAX_CONTACTS_PER_KAFKA_MESSAGE) {
            const batch = contacts.slice(i, i + MAX_CONTACTS_PER_KAFKA_MESSAGE).map(c => ({
                _id: String(c._id),
                phone: c.phone,
                variables: c.variables || {}
            }));

            await producer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify({ jobDetails: jobData, contacts: batch }) }]
            });
        }

        await logSafe(db, broadcastId, projectId, 'INFO', `Queued all contacts`);

    } catch (err) {
        await logSafe(db, broadcastId, projectId, 'ERROR', `Queue failed: ${getErrorMessage(err)}`);
        await db.collection('broadcasts').updateOne(
            { _id: broadcastId },
            { $set: { status: 'QUEUED', lastError: getErrorMessage(err) }, $unset: { startedAt: "" } }
        );
    } finally {
        await producer.disconnect().catch(() => { });
    }
}

/** Main Cron Function */
export async function processBroadcastJob() {
    console.log(`[CRON] Start ${new Date().toISOString()}`);

    // Connect DB
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch {
        return { error: "DB connection failed" };
    }

    await resetStuckJobs(db);

    // Pick 1 job
    let job: WithId<BroadcastJob> | null = null;

    try {
        const res = await db.collection('broadcasts').findOneAndUpdate(
            { status: "QUEUED" },
            { $set: { status: "PROCESSING", startedAt: new Date() } },
            { returnDocument: "after", sort: { createdAt: 1 } }
        );

        job = res?.value ?? null;

    } catch (err) {
        return { error: getErrorMessage(err) };
    }

    // CRITICAL FIX: prevent "job undefined"
    if (!job) {
        return { message: "No queued jobs found." };
    }

    // Start background job
    processJobContacts(db, job).catch(err =>
        console.error("[CRON BACKGROUND ERROR]", err)
    );

    return { message: `Job ${String(job._id)} picked up for processing.` };
}
