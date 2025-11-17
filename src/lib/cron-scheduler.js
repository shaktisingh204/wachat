'use strict';

require('dotenv').config();
const { connectToDatabase } = require('../lib/mongodb.js');
const { Kafka, Partitioners } = require('kafkajs');
const { ObjectId } = require('mongodb');
const { getErrorMessage } = require('../lib/utils.js');

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const KAFKA_TOPIC = 'broadcasts';
const MAX_CONTACTS_PER_KAFKA_MESSAGE = 500;
const STUCK_JOB_TIMEOUT_MINUTES = 10;

/**
 * Logs a message to the dedicated broadcast log collection.
 * @param {import('mongodb').Db} db The MongoDB database instance.
 * @param {ObjectId} broadcastId The ID of the broadcast job.
 * @param {ObjectId} projectId The ID of the project.
 * @param {'INFO'|'ERROR'|'WARN'} level The log level.
 * @param {string} message The log message.
 * @param {object} [meta={}] Additional metadata.
 */
async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
    try {
        if (!db || !broadcastId || !projectId) return;
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

/**
 * Resets jobs stuck in a 'PROCESSING' state for too long.
 * @param {import('mongodb').Db} db The MongoDB database instance.
 */
async function resetStuckJobs(db) {
    const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
    const result = await db.collection('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: timeout } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } }
    );
    if (result.modifiedCount > 0) {
        console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast jobs.`);
    }
}

/**
 * Main function for the cron job. Finds and processes one queued broadcast job.
 */
async function processBroadcastJob() {
    console.log(`[CRON-SCHEDULER] Starting run at ${new Date().toISOString()}`);
    
    let db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.error('[CRON-SCHEDULER] DB connection failed:', errorMessage);
        return { error: 'Database connection failed' };
    }

    try { await resetStuckJobs(db); } catch (err) { console.error('[CRON-SCHEDULER] Error resetting stuck jobs:', getErrorMessage(err)); }

    const findResult = await db.collection('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
    );
    
    // *** CRITICAL FIX: Extract the document from the 'value' property ***
    const job = findResult;

    if (!job) {
        console.log('[CRON-SCHEDULER] No queued broadcast jobs found.');
        return { message: 'No queued jobs found.' };
    }

    const kafka = new Kafka({ clientId: `broadcast-producer-${job._id}`, brokers: KAFKA_BROKERS });
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

    try {
        await producer.connect();
        
        const contactsCursor = db.collection('broadcast_contacts').find({ 
            broadcastId: job._id, 
            status: 'PENDING' 
        }).project({ _id: 1, phone: 1, variables: 1 });

        let batch = [];
        let totalQueued = 0;
        let totalContactsInJob = 0;

        for await (const contact of contactsCursor) {
            totalContactsInJob++;
            batch.push(contact);
            if (batch.length >= MAX_CONTACTS_PER_KAFKA_MESSAGE) {
                await producer.send({
                    topic: KAFKA_TOPIC,
                    messages: [{ value: JSON.stringify({ jobDetails: job, contacts: batch }) }],
                });
                totalQueued += batch.length;
                batch = [];
            }
        }
        
        if (batch.length > 0) {
            await producer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify({ jobDetails: job, contacts: batch }) }],
            });
            totalQueued += batch.length;
        }

        const msg = `[SCHEDULER] Queued ${totalQueued} contacts for job ${job._id} to topic '${KAFKA_TOPIC}'.`;
        console.log(msg);
        await addBroadcastLog(db, job._id, job.projectId, 'INFO', msg);
        
        // If there were no pending contacts to begin with, the worker won't finalize it.
        if (totalContactsInJob === 0) {
            await db.collection('broadcasts').updateOne(
                { _id: job._id, status: 'PROCESSING' },
                { $set: { status: 'Completed', completedAt: new Date() } }
            );
            await addBroadcastLog(db, job._id, job.projectId, 'INFO', `[SCHEDULER] Job has no pending contacts. Finalizing as complete.`);
        }
        
        return { message: `Job ${job._id} picked up. Queued ${totalQueued} contacts.` };

    } catch (err) {
        const errorMsg = getErrorMessage(err);
        console.error(`[CRON-SCHEDULER] Failed to process job ${job._id}:`, errorMsg);
        await addBroadcastLog(db, job._id, job.projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
        await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } });
        return { error: `Failed to process job: ${errorMsg}` };
    } finally {
        await producer.disconnect().catch(e => console.error("Failed to disconnect Kafka producer", e));
    }
}

module.exports = { processBroadcastJob };
