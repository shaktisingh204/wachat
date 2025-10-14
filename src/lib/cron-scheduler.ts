
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka, Partitioners, type Producer } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType, WithId } from './definitions';
import { getErrorMessage } from './utils';

const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const KAFKA_TOPIC = 'messages';
const KAFKA_MESSAGE_BATCH_SIZE = 500; // Number of contacts per Kafka message
const ONE_HUNDRED_MEGABYTES = 100 * 1024 * 1024;


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

export async function processBroadcastJob() {
    let db: Db;
    let jobDetails: WithId<BroadcastJobType> | null = null;
    let broadcastId: ObjectId | undefined;
    let projectId: ObjectId | undefined;
    
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (dbError) {
        const errorMsg = getErrorMessage(dbError);
        console.error("[CRON-SCHEDULER] Database connection failed:", errorMsg);
        throw new Error("Could not connect to the database.");
    }

    try {
        // Step 1: Find a QUEUED job
        const queuedJob = await db.collection<WithId<BroadcastJobType>>('broadcasts').findOne({ status: 'QUEUED' });

        if (!queuedJob) {
            return { message: 'No queued broadcast jobs to process.' };
        }

        // Step 2: Atomically lock the job to PROCESSING
        const lockResult = await db.collection('broadcasts').updateOne(
            { _id: queuedJob._id, status: 'QUEUED' }, // Ensure we only update if it's still queued
            { $set: { status: 'PROCESSING', startedAt: new Date() } }
        );

        if (lockResult.matchedCount === 0) {
            // Another worker likely grabbed this job in the small window between find and update.
            return { message: `Job ${queuedJob._id} was processed by another worker. Skipping.` };
        }

        jobDetails = { ...queuedJob, status: 'PROCESSING', startedAt: new Date() };
        broadcastId = jobDetails._id;
        projectId = jobDetails.projectId;
        
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Cron job picked up broadcast ${broadcastId} and set status to PROCESSING.`);
        
        // Step 3: Fetch contacts for the locked job
        const contacts = await db.collection('broadcast_contacts').find({
            broadcastId: broadcastId, // Use the ObjectId
            status: 'PENDING'
        }).toArray();

        if (contacts.length === 0) {
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId },
                { $set: { status: 'Completed', completedAt: new Date() } }
            );
            const completionMessage = `Broadcast ${broadcastId} had no pending contacts to send and is now marked as Completed.`;
            await addBroadcastLog(db, broadcastId, projectId, 'WARN', completionMessage);
            return { message: completionMessage };
        }
        
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Found ${contacts.length} pending contacts for broadcast.`);
        
        const kafka = new Kafka({ clientId: 'broadcast-producer', brokers: KAFKA_BROKERS });
        const producer = kafka.producer({
             createPartitioner: Partitioners.DefaultPartitioner,
             maxRequestSize: ONE_HUNDRED_MEGABYTES,
        });

        await producer.connect();
        
        try {
            let messagesSent = 0;
            for (let i = 0; i < contacts.length; i += KAFKA_MESSAGE_BATCH_SIZE) {
                const batch = contacts.slice(i, i + KAFKA_MESSAGE_BATCH_SIZE);
                const messagePayload = {
                    jobDetails: JSON.parse(JSON.stringify(jobDetails)),
                    contacts: JSON.parse(JSON.stringify(batch))
                };
                
                const messageString = JSON.stringify(messagePayload);
                const messageSize = Buffer.from(messageString).length;

                console.log(`[CRON-SCHEDULER] Preparing to send batch ${messagesSent + 1} of size ${messageSize / 1024} KB`);

                await producer.send({
                    topic: KAFKA_TOPIC,
                    messages: [{ value: messageString }]
                });
                messagesSent++;
            }

            const successMessage = `Successfully queued ${contacts.length} contacts to Kafka in ${messagesSent} messages for broadcast ${broadcastId}.`;
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', successMessage);
            return { message: successMessage };

        } catch(kafkaError: any) {
            const detailedErrorMessage = `Failed to push job ${broadcastId} to Kafka.`;
            console.error(`[CRON-SCHEDULER] KAFKA SEND ERROR: ${detailedErrorMessage}`, kafkaError);
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', detailedErrorMessage, { stack: kafkaError.stack, message: kafkaError.message });
            throw new Error(detailedErrorMessage);
        } finally {
             if (producer) {
                 await producer.disconnect().catch(e => console.error("[CRON-SCHEDULER] Error disconnecting Kafka producer:", e));
            }
        }

    } catch (error: any) {
        const baseErrorMessage = `Broadcast processing failed${broadcastId ? ` for job ${broadcastId}` : ''}: ${getErrorMessage(error)}`;
        console.error(`[CRON-SCHEDULER] ${baseErrorMessage}`, error.stack);

        if (broadcastId && projectId && db) {
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', baseErrorMessage, { stack: error.stack });
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId, status: 'PROCESSING' },
                { $set: { status: 'Failed', error: baseErrorMessage, completedAt: new Date() } }
            );
        }
        throw new Error(baseErrorMessage);
    }
}
