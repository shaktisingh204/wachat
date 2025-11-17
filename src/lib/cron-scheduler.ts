
'use strict';

require('dotenv').config();
const { connectToDatabase } = require('../lib/mongodb.js');
const { Kafka, Partitioners } = require('kafkajs');
const { ObjectId } = require('mongodb');
const { getErrorMessage } = require('../lib/utils.js');

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const KAFKA_TOPIC = 'broadcasts';
const MAX_KAFKA_MESSAGE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_CONTACTS_PER_KAFKA_MESSAGE = 500;
const STUCK_JOB_TIMEOUT_MINUTES = 10;

async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
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
        console.error(`[CRON-SCHEDULER] Failed to write log for job ${broadcastId}:`, e);
    }
}

async function resetStuckJobs(db) {
    const tenMinutesAgo = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
    const result = await db.collection('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: tenMinutesAgo } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
    );
    if (result.modifiedCount > 0) {
        console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast jobs.`);
    }
}

function sanitizeForKafka(job) {
    if (!job) return null;
    const sanitizedJob = JSON.parse(JSON.stringify(job));
    return sanitizedJob;
}

async function processSingleJob(db, job) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Picked up job ${broadcastId} for processing.`);

    const contacts = await db.collection('broadcast_contacts').find({ 
        broadcastId: new ObjectId(broadcastId), 
        status: 'PENDING' 
    }).project({ _id: 1, phone: 1, variables: 1 }).toArray();

    if (!contacts.length) {
        const msg = `[SCHEDULER] Job ${broadcastId} has no pending contacts to queue. A worker will finalize it if processing is complete.`;
        console.log(msg);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
        return;
    }

    const kafka = new Kafka({
        clientId: `broadcast-producer-${broadcastId}`,
        brokers: KAFKA_BROKERS,
        connectionTimeout: 5000,
        requestTimeout: 30000
    });

    const producer = kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
        maxRequestSize: MAX_KAFKA_MESSAGE_SIZE,
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

        await producer.send({
            topic: KAFKA_TOPIC,
            messages: messages,
        });

        const msg = `[SCHEDULER] Instantly queued ${totalQueued}/${contacts.length} contacts in ${messages.length} batches for job ${broadcastId}.`;
        console.log(msg);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);

    } catch (err) {
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

async function processBroadcastJob() {
    console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);

    let db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (err) {
        console.error('[CRON-SCHEDULER] DB connection failed:', getErrorMessage(err));
        return { error: 'DB connection failed' };
    }

    try { await resetStuckJobs(db); } catch (err) { console.error('[CRON-SCHEDULER] Error resetting jobs:', getErrorMessage(err)); }

    const findResult = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
    );
    
    // The actual job document is in the 'value' property.
    const job = findResult.value;

    if (!job) {
        console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }

    // Run in the background; don't await. This makes the cron API endpoint return immediately.
    processSingleJob(db, job).catch(err => {
        console.error(`[CRON-SCHEDULER] Unhandled error in background job processing for ${job._id}:`, getErrorMessage(err));
    });

    return { message: `Job ${job._id} picked up for processing.` };
}

module.exports = { processBroadcastJob };
