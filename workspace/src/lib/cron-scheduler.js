
'use strict';

require('dotenv').config();
const { connectToDatabase } = require('./mongodb.js');
const { Kafka, Partitioners } = require('kafkajs');
const { ObjectId } = require('mongodb');
const { getErrorMessage } = require('./utils.js');

// --- CONFIGURATION ---
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const KAFKA_TOPIC = 'broadcasts'; // Unified topic
const MAX_CONTACTS_PER_KAFKA_MESSAGE = 500;
const STUCK_JOB_TIMEOUT_MINUTES = 10;
const MAX_KAFKA_MESSAGE_SIZE = 5 * 1024 * 1024; // 5MB limit for safety

/**
 * Logs a message to the dedicated broadcast log collection.
 * @param {import('mongodb').Db} db - The MongoDB database instance.
 * @param {ObjectId} broadcastId - The ID of the broadcast job.
 * @param {ObjectId} projectId - The ID of the project.
 * @param {'INFO'|'ERROR'|'WARN'} level - The log level.
 * @param {string} message - The log message.
 * @param {object} [meta={}] - Additional metadata.
 */
async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
    try {
        if (!db || !broadcastId || !projectId) {
            console.error(`[CRON] Log attempt failed: Missing db, broadcastId, or projectId.`);
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
        console.error(`[CRON] Failed to write log for job ${broadcastId}:`, e);
    }
}

/**
 * Finds and resets broadcast jobs stuck in 'PROCESSING' state.
 * @param {import('mongodb').Db} db - The MongoDB database instance.
 */
async function resetStuckJobs(db) {
    const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
    const result = await db.collection('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: timeout } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
    );
    if (result.modifiedCount > 0) {
        console.log(`[CRON] Reset ${result.modifiedCount} stuck broadcast jobs.`);
    }
}

/**
 * Sanitizes a MongoDB document for safe Kafka serialization.
 * Converts ObjectIds and Dates to strings.
 * @param {object} job - The broadcast job document.
 * @returns {object | null} A serializable plain JavaScript object.
 */
function sanitizeForKafka(job) {
    if (!job) return null;
    const sanitized = { ...job };
    for (const key in sanitized) {
        if (sanitized[key] instanceof ObjectId) {
            sanitized[key] = sanitized[key].toString();
        } else if (sanitized[key] instanceof Date) {
            sanitized[key] = sanitized[key].toISOString();
        }
    }
    return sanitized;
}

/**
 * Fetches all pending contacts for a job and pushes them in batches to Kafka.
 * @param {import('mongodb').Db} db - The MongoDB database instance.
 * @param {Kafka} kafka - The Kafka instance.
 * @param {object} job - The broadcast job to process.
 */
async function processSingleJob(db, kafka, job) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Picked up job ${broadcastId} for processing.`);

    const contactsCursor = db.collection('broadcast_contacts').find({ 
        broadcastId: new ObjectId(broadcastId), 
        status: 'PENDING' 
    }).project({ _id: 1, phone: 1, variables: 1 });

    const totalPending = await db.collection('broadcast_contacts').countDocuments({ broadcastId: new ObjectId(broadcastId), status: 'PENDING' });

    if (totalPending === 0) {
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `[SCHEDULER] Job has no pending contacts. A worker will finalize it.`);
        return;
    }

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
        
        let contactBatch = [];
        for await (const contact of contactsCursor) {
            contactBatch.push(contact);
            if (contactBatch.length >= MAX_CONTACTS_PER_KAFKA_MESSAGE) {
                await producer.send({
                    topic: KAFKA_TOPIC,
                    messages: [{ value: JSON.stringify({ jobDetails: sanitizedJobDetails, contacts: contactBatch }) }],
                });
                totalQueued += contactBatch.length;
                contactBatch = [];
            }
        }
        
        // Send any remaining contacts in the last batch
        if (contactBatch.length > 0) {
            await producer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify({ jobDetails: sanitizedJobDetails, contacts: contactBatch }) }],
            });
            totalQueued += contactBatch.length;
        }

        const msg = `[SCHEDULER] Queued ${totalQueued}/${totalPending} contacts for job ${broadcastId} to topic '${KAFKA_TOPIC}'.`;
        console.log(msg);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', msg);

    } catch (err) {
        const errorMsg = getErrorMessage(err);
        console.error(`[CRON] Job ${broadcastId} failed to queue:`, errorMsg);
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
    console.log(`[CRON] Starting broadcast processing job run at ${new Date().toISOString()}`);

    let db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (err) {
        console.error('[CRON] DB connection failed:', getErrorMessage(err));
        return { error: 'DB connection failed' };
    }

    try { await resetStuckJobs(db); } catch (err) { console.error('[CRON] Error resetting jobs:', getErrorMessage(err)); }

    const job = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
    );
    
    if (!job) {
        console.log('[CRON] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }
    
    const kafka = new Kafka({
        clientId: `broadcast-producer-${job._id}`,
        brokers: KAFKA_BROKERS,
        connectionTimeout: 5000,
        requestTimeout: 30000,
    });
    
    // Run job processing in the background without awaiting it.
    processSingleJob(db, kafka, job).catch(err => {
        console.error(`[CRON] Unhandled error in background job processing for ${job._id}:`, getErrorMessage(err));
    });

    return { message: `Job ${job._id} picked up for processing.` };
}

module.exports = { processBroadcastJob };
