'use strict';

require('dotenv').config();
const { connectToDatabase } = require('../lib/mongodb.js');
const { Kafka, Partitioners } = require('kafkajs');
const { ObjectId } = require('mongodb');
const { getErrorMessage } = require('../lib/utils.js');

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const KAFKA_TOPIC = 'broadcasts'; // Unified topic
const MAX_BATCH_CONTACTS = 500;
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
        console.error('[CRON-SCHEDULER] Failed to write log:', e);
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

async function processSingleJob(db, job) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Scheduler picked up job ${broadcastId} for processing.`);

    const contacts = await db.collection('broadcast_contacts').find({ 
        broadcastId: new ObjectId(broadcastId), 
        status: 'PENDING' 
    }).toArray();

    if (!contacts.length) {
        const jobState = await db.collection('broadcasts').findOne({ _id: broadcastId });
        if (jobState && (jobState.successCount + jobState.errorCount) >= jobState.contactCount) {
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId },
                { $set: { status: 'Completed', completedAt: new Date() } }
            );
            const msg = `Job ${broadcastId} has no pending contacts. Marked as complete.`;
            console.log(`[CRON-SCHEDULER] ${msg}`);
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
        } else {
            const msg = `Job ${broadcastId} has no pending contacts, but counts don't match total. Worker will finalize.`;
            console.log(`[CRON-SCHEDULER] ${msg}`);
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);
        }
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
        maxRequestSize: 100 * 1024 * 1024
    });

    try {
        await producer.connect();
        let totalQueued = 0;

        for (let i = 0; i < contacts.length; i += MAX_BATCH_CONTACTS) {
            const batch = contacts.slice(i, i + MAX_BATCH_CONTACTS);
            await producer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify({ jobDetails: job, contacts: batch }) }],
            });
            totalQueued += batch.length;
        }

        const msg = `Queued ${totalQueued}/${contacts.length} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
        console.log(`[CRON-SCHEDULER] ${msg}`);
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

    const jobResult = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
    );

    const job = jobResult.value;

    if (!job) {
        console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }

    processSingleJob(db, job).catch(err => console.error(`[CRON-SCHEDULER] Unhandled error in background job processing for ${job._id}:`, getErrorMessage(err)));

    return { message: `Job ${job._id} picked up for processing.` };
}

module.exports = { processBroadcastJob };
