
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
const LOG_PREFIX = '[CRON-SCHEDULER]';

async function addBroadcastLog(db, broadcastId, projectId, level, message, meta = {}) {
    try {
        if (!db || !broadcastId || !projectId) {
            console.error(`${LOG_PREFIX} Log attempt failed: Missing db, broadcastId, or projectId.`);
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
        console.error(`${LOG_PREFIX} Failed to write log for job ${String(broadcastId)}:`, e);
    }
}

async function resetStuckJobs(db) {
    const timeout = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
    const result = await db.collection('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: timeout } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } }
    );
    if (result.modifiedCount > 0) {
        console.log(`${LOG_PREFIX} Reset ${result.modifiedCount} stuck broadcast jobs.`);
    }
}

async function processBroadcastJob() {
    console.log(`${LOG_PREFIX} Starting run at ${new Date().toISOString()}`);
    let db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.error(`${LOG_PREFIX} DB connection failed:`, errorMessage);
        return { error: 'Database connection failed' };
    }

    try { await resetStuckJobs(db); } catch (err) { console.error(`${LOG_PREFIX} Error resetting stuck jobs:`, getErrorMessage(err)); }

    let findResult;
    try {
        findResult = await db.collection('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: 'after' }
        );
    } catch (dbError) {
        console.error(`${LOG_PREFIX} findOneAndUpdate failed:`, getErrorMessage(dbError));
        return { error: 'Failed to query for a job.' };
    }

    const job = findResult;

    if (!job) {
        console.log(`${LOG_PREFIX} No queued broadcast jobs found.`);
        return { message: 'No queued jobs found.' };
    }

    await addBroadcastLog(db, job._id, job.projectId, 'INFO', `Job ${job._id} picked up for processing.`);

    const kafka = new Kafka({ clientId: `broadcast-producer-${job._id}`, brokers: KAFKA_BROKERS });
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

    try {
        await producer.connect();
        
        const contactsCursor = db.collection('broadcast_contacts').find({ 
            broadcastId: job._id, 
            status: 'PENDING' 
        });

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

        const msg = `${LOG_PREFIX} Queued ${totalQueued} contacts for job ${job._id} to topic '${KAFKA_TOPIC}'.`;
        console.log(msg);
        await addBroadcastLog(db, job._id, job.projectId, 'INFO', msg);
        
        if (totalContactsInJob === 0) {
            await db.collection('broadcasts').updateOne(
                { _id: job._id, status: 'PROCESSING' },
                { $set: { status: 'Completed', completedAt: new Date() } }
            );
            await addBroadcastLog(db, job._id, job.projectId, 'INFO', `${LOG_PREFIX} Job has no pending contacts. Finalizing as complete.`);
        }
        
        return { message: `Job ${job._id} picked up. Queued ${totalQueued} contacts.` };

    } catch (err) {
        const errorMsg = getErrorMessage(err);
        console.error(`${LOG_PREFIX} Failed to process job ${job._id}:`, errorMsg);
        await addBroadcastLog(db, job._id, job.projectId, 'ERROR', `Scheduler failed to queue messages: ${errorMsg}`);
        await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'QUEUED' }, $unset: { startedAt: "" } });
        return { error: `Failed to process job: ${errorMsg}` };
    } finally {
        await producer.disconnect().catch(e => console.error(`${LOG_PREFIX} Failed to disconnect Kafka producer`, e));
    }
}

module.exports = { processBroadcastJob };
