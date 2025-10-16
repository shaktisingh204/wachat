
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
const KAFKA_MESSAGE_BATCH_SIZE = 5000;
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

export async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (dbError) {
        const errorMsg = getErrorMessage(dbError);
        console.error("[CRON-SCHEDULER] Database connection failed:", errorMsg);
        throw new Error("Could not connect to the database.");
    }

    await resetStuckJobs(db);
    await markCompletedJobs(db);

    let jobsProcessed = 0;
    const allErrors: string[] = [];
    const workerId = new ObjectId().toString();

    // The while loop allows the single cron instance to process all available jobs in one run
    while (true) {
        let job: WithId<BroadcastJobType> | null = null;
        let broadcastId: ObjectId | undefined;
        let projectId: ObjectId | undefined;

        try {
            job = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
                { status: 'QUEUED' },
                { $set: { status: 'PROCESSING', startedAt: new Date() } },
                { returnDocument: 'after', sort: { createdAt: 1 } }
            );

            if (!job) {
                // No more jobs to process, break the loop silently
                break;
            }

            broadcastId = job._id;
            projectId = job.projectId;

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
                jobsProcessed++;
                continue; // Process the next job in the while loop
            }

            const KAFKA_TOPIC = contacts.length > 5000 ? HIGH_PRIORITY_TOPIC : LOW_PRIORITY_TOPIC;
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Found ${contacts.length} contacts. Routing to topic: ${KAFKA_TOPIC}.`);

            const kafka = new Kafka({ clientId: `broadcast-producer-${broadcastId}`, brokers: KAFKA_BROKERS });
            const producer = kafka.producer({
                createPartitioner: Partitioners.DefaultPartitioner,
                maxRequestSize: ONE_HUNDRED_MEGABYTES,
            });
            await producer.connect();
            
            try {
                let messagesSentToKafka = 0;
                for (let i = 0; i < contacts.length; i += KAFKA_MESSAGE_BATCH_SIZE) {
                    const batch = contacts.slice(i, i + KAFKA_MESSAGE_BATCH_SIZE);
                    const messagePayload = {
                        jobDetails: JSON.parse(JSON.stringify(job)),
                        contacts: JSON.parse(JSON.stringify(batch))
                    };
                    const messageString = JSON.stringify(messagePayload);
                    
                    await producer.send({
                        topic: KAFKA_TOPIC,
                        messages: [{ value: messageString }]
                    });
                    messagesSentToKafka++;
                }

                await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Queued ${contacts.length} contacts to Kafka in ${messagesSentToKafka} messages.`);
                jobsProcessed++;
            } finally {
                await producer.disconnect();
            }
        } catch (error: any) {
            const baseErrorMessage = `Broadcast processing failed for job ${broadcastId}: ${getErrorMessage(error)}`;
            console.error(`[CRON-SCHEDULER] ${baseErrorMessage}`, error.stack);
            allErrors.push(baseErrorMessage);

            if (job && db) {
                await addBroadcastLog(db, job._id, job.projectId, 'ERROR', baseErrorMessage, { stack: error.stack });
                // Revert status to QUEUED so it can be retried
                await db.collection('broadcasts').updateOne(
                    { _id: job._id, status: 'PROCESSING' },
                    { $set: { status: 'QUEUED', lastError: baseErrorMessage }, $unset: { startedAt: '' } }
                );
            }
        }
    }
    
    if (allErrors.length > 0) {
        throw new Error(`Completed processing with ${allErrors.length} failure(s): ${allErrors.join('; ')}`);
    }

    return { message: `Successfully processed ${jobsProcessed} queued broadcast jobs.` };
}
