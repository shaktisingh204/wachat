
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka, Partitioners, type Producer } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType, WithId } from './definitions';
import { getErrorMessage } from './utils';

const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const LOW_PRIORITY_TOPIC = 'low-priority-broadcasts';
const HIGH_PRIORITY_TOPIC = 'high-priority-broadcasts';
const KAFKA_MESSAGE_BATCH_SIZE = 200;
const ONE_HUNDRED_MEGABYTES = 100 * 1024 * 1024;
const STUCK_JOB_TIMEOUT_MINUTES = 10;

const addBroadcastLog = async (db: Db, broadcastId: ObjectId, projectId: ObjectId, level: 'INFO' | 'ERROR' | 'WARN', message: string, meta?: Record<string, any>) => {
    try {
        if (!db || !broadcastId || !projectId) return;
        await db.collection('broadcast_logs').insertOne({
            broadcastId,
            projectId,
            level,
            message,
            meta,
            timestamp: new Date(),
        });
    } catch (e) {
        console.error("Failed to write broadcast log:", e);
    }
};

async function resetStuckJobs(db: Db) {
    const tenMinutesAgo = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);
    const result = await db.collection('broadcasts').updateMany(
        { status: 'PROCESSING', startedAt: { $lt: tenMinutesAgo } },
        { $set: { status: 'QUEUED' }, $unset: { startedAt: '' } }
    );
    if (result.modifiedCount > 0) {
        console.log(`[CRON-SCHEDULER] Reset ${result.modifiedCount} stuck broadcast job(s).`);
    }
}

async function markCompletedJobs(db: Db) {
    const result = await db.collection('broadcasts').updateMany(
        {
            status: 'PROCESSING',
            $expr: { $gte: [ { $add: [ "$successCount", "$errorCount" ] }, "$contactCount" ] }
        },
        {
            $set: { status: 'Completed', completedAt: new Date() }
        }
    );
     if (result.modifiedCount > 0) {
        console.log(`[CRON-SCHEDULER] Marked ${result.modifiedCount} finished broadcast job(s) as Completed.`);
    }
}

async function processSingleJob(db: Db, job: WithId<BroadcastJobType>) {
    const broadcastId = job._id;
    const projectId = job.projectId;

    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Cron job picked up broadcast ${broadcastId} and set status to PROCESSING.`);

    const contacts = await db.collection('broadcast_contacts').find({
        broadcastId: broadcastId,
        status: 'PENDING'
    }).toArray();

    if (contacts.length === 0) {
        await db.collection('broadcasts').updateOne(
            { _id: broadcastId },
            { $set: { status: 'Completed', completedAt: new Date() } }
        );
        await addBroadcastLog(db, broadcastId, projectId, 'WARN', `Broadcast ${broadcastId} had no pending contacts.`);
        return { success: true, message: `Job ${broadcastId} completed with no pending contacts.` };
    }

    const KAFKA_TOPIC = contacts.length > 5000 ? HIGH_PRIORITY_TOPIC : LOW_PRIORITY_TOPIC;
    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Found ${contacts.length} contacts. Routing to topic: ${KAFKA_TOPIC}.`);
    console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Found ${contacts.length} contacts. Routing to topic: ${KAFKA_TOPIC}.`);

    const kafka = new Kafka({
        clientId: `broadcast-producer-${broadcastId}`,
        brokers: KAFKA_BROKERS,
        connectionTimeout: 5000,
        requestTimeout: 30000,
    });
    const producer = kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
        maxRequestSize: ONE_HUNDRED_MEGABYTES,
    });

    let jobError = null;
    try {
        await producer.connect();
        console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Kafka producer connected.`);
        
        let messagesSentToKafka = 0;
        const sendErrors: string[] = [];
        for (let i = 0; i < contacts.length; i += KAFKA_MESSAGE_BATCH_SIZE) {
            const batch = contacts.slice(i, i + KAFKA_MESSAGE_BATCH_SIZE);
            const messagePayload = {
                jobDetails: JSON.parse(JSON.stringify(job)),
                contacts: JSON.parse(JSON.stringify(batch))
            };
            const messageString = JSON.stringify(messagePayload);
            
            console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Sending batch ${Math.floor(i / KAFKA_MESSAGE_BATCH_SIZE) + 1} with ${batch.length} contacts.`);
            try {
                await producer.send({
                    topic: KAFKA_TOPIC,
                    messages: [{ value: messageString }]
                });
                messagesSentToKafka++;
            } catch (kafkaError: any) {
                const errorMsg = `Failed to send batch ${Math.floor(i / KAFKA_MESSAGE_BATCH_SIZE) + 1} to Kafka: ${getErrorMessage(kafkaError)}`;
                console.error(`[CRON-SCHEDULER] ${errorMsg}`);
                sendErrors.push(errorMsg);
                await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMsg, { stack: kafkaError.stack });
            }
        }

        if (sendErrors.length > 0) {
            jobError = `Encountered ${sendErrors.length} errors while sending to Kafka.`;
        }

        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Queued ${contacts.length} contacts to Kafka in ${messagesSentToKafka} messages.`);
        console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Pushed ${contacts.length} contacts to Kafka in ${messagesSentToKafka} message(s).`);

    } catch (err) {
        jobError = getErrorMessage(err);
    } finally {
        await producer.disconnect();
        console.log(`[CRON-SCHEDULER] Job ${broadcastId}: Kafka producer disconnected.`);
    }
    
    if (jobError) {
        throw new Error(jobError);
    }
    return { success: true, message: `Successfully queued ${contacts.length} contacts for job ${broadcastId}.` };
}

export async function processBroadcastJob() {
    console.log(`[CRON-SCHEDULER] Starting broadcast processing job run at ${new Date().toISOString()}`);
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (dbError) {
        const errorMsg = getErrorMessage(dbError);
        console.error("[CRON-SCHEDULER] Database connection failed:", errorMsg);
        return { message: null, error: "Could not connect to the database." };
    }

    try {
        await resetStuckJobs(db);
        await markCompletedJobs(db);
    } catch (maintenanceError) {
        console.error("[CRON-SCHEDULER] Error during maintenance tasks:", maintenanceError);
    }

    const jobResult = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
        { status: 'QUEUED' },
        { $set: { status: 'PROCESSING', startedAt: new Date() } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
    );

    const job = jobResult;

    if (!job) {
        const msg = "No queued broadcast jobs found to process.";
        console.log(`[CRON-SCHEDULER] ${msg}`);
        return { message: msg, error: null };
    }

    try {
        const result = await processSingleJob(db, job);
        console.log(`[CRON-SCHEDULER] Finished job ${job._id}: ${result.message}`);
        return result;
    } catch (error: any) {
        const baseErrorMessage = `Broadcast processing failed for job ${job._id}: ${getErrorMessage(error)}`;
        console.error(`[CRON-SCHEDULER] ${baseErrorMessage}`, { stack: error.stack });
        
        await addBroadcastLog(db, job._id, job.projectId, 'ERROR', baseErrorMessage, { stack: error.stack });
        await db.collection('broadcasts').updateOne(
            { _id: job._id, status: 'PROCESSING' },
            { $set: { status: 'QUEUED', lastError: baseErrorMessage }, $unset: { startedAt: '' } }
        );
        return { message: null, error: baseErrorMessage };
    }
}
