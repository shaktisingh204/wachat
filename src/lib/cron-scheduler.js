
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

/**
 * Logs a message to the dedicated broadcast log collection in MongoDB.
 * @param {Db} db - The MongoDB database instance.
 * @param {ObjectId} broadcastId - The ID of the broadcast job.
 * @param {ObjectId} projectId - The ID of the project.
 * @param {'INFO' | 'ERROR' | 'WARN'} level - The log level.
 * @param {string} message - The log message.
 * @param {object} [meta={}] - Additional metadata to log.
 */
async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
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
        console.error(`[CRON-SCHEDULER] Failed to write log for job ${broadcastId}:`, e);
    }
}

/**
 * Finds broadcast jobs stuck in the 'PROCESSING' state for too long and resets them to 'QUEUED'.
 * @param {Db} db - The MongoDB database instance.
 */
async function resetStuckJobs(db) {
    const tenMinutesAgo = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
    const result = await db.collection('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: tenMinutesAgo } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
    );
    if (result.modifiedCount > 0) {
        console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast jobs.`);
        // Note: Logging this to each individual job log might be noisy. A system-level log could be better.
    }
}

/**
 * Sanitizes a MongoDB document for safe Kafka serialization by converting ObjectIds and Dates to strings.
 * @param {object} job - The broadcast job document from MongoDB.
 * @returns {object | null} A serializable plain JavaScript object.
 */
function sanitizeForKafka(job) {
    if (!job) return null;
    
    // Create a deep copy to avoid modifying the original object
    const sanitizedJob = JSON.parse(JSON.stringify(job));
    
    // Explicitly convert ObjectId and Date fields to strings
    if (sanitizedJob._id) sanitizedJob._id = sanitizedJob._id.toString();
    if (sanitizedJob.projectId) sanitizedJob.projectId = sanitizedJob.projectId.toString();
    if (sanitizedJob.templateId) sanitizedJob.templateId = sanitizedJob.templateId.toString();
    if (sanitizedJob.createdAt) sanitizedJob.createdAt = new Date(sanitizedJob.createdAt).toISOString();
    if (sanitizedJob.startedAt) sanitizedJob.startedAt = new Date(sanitizedJob.startedAt).toISOString();
    if (sanitizedJob.completedAt) sanitizedJob.completedAt = new Date(sanitizedJob.completedAt).toISOString();
    
    return sanitizedJob;
}

/**
 * Fetches pending contacts for a job and pushes them in batches to a Kafka topic.
 * @param {Db} db - The MongoDB database instance.
 * @param {object} job - The broadcast job to process.
 */
async function processSingleJob(db, job) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Picked up job ${broadcastId} for processing.`);

    const contacts = await db.collection('broadcast_contacts').find({ 
        broadcastId: new ObjectId(broadcastId), 
        status: 'PENDING' 
    }).project({ _id: 1, phone: 1, variables: 1 }).toArray();

    if (!contacts.length) {
        // If there are no pending contacts, check if the job is already finished.
        const finalJobState = await db.collection('broadcasts').findOne({ _id: broadcastId });
        if (finalJobState && (finalJobState.successCount + finalJobState.errorCount) >= finalJobState.contactCount) {
             await db.collection('broadcasts').updateOne(
                { _id: broadcastId, status: 'PROCESSING' },
                { $set: { status: 'Completed', completedAt: new Date() } }
            );
             await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job has no pending contacts and is complete. Finalizing.`);
        } else {
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job has no pending contacts to queue at this time. A worker will finalize it.`);
        }
        return;
    }

    const kafka = new Kafka({
        clientId: `broadcast-producer-${broadcastId}`,
        brokers: KAFKA_BROKERS,
        connectionTimeout: 5000,
        requestTimeout: 30000,
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

        const msg = `[SCHEDULER] Queued ${totalQueued}/${contacts.length} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
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

/**
 * Main function for the cron job. Finds and processes one queued broadcast job.
 */
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
    
    // Check if a job was found and its value exists
    if (!findResult) {
        console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }
    const job = findResult;
    
    // Run the job processing in the background; don't await. This makes the cron API endpoint return immediately.
    processSingleJob(db, job).catch(err => {
        console.error(`[CRON-SCHEDULER] Unhandled error in background job processing for ${job._id}:`, getErrorMessage(err));
    });

    return { message: `Job ${job._id} picked up for processing.` };
}

module.exports = { processBroadcastJob };
