
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
    let kafka: Kafka | null = null;
    let producer: Producer | null = null;
    let jobDetails: WithId<BroadcastJobType> | null = null;
    let broadcastId: ObjectId | undefined;
    let projectId: ObjectId | undefined;

    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (dbError) {
        console.error("[CRON-SCHEDULER] Database connection failed:", dbError);
        throw new Error("Could not connect to the database.");
    }
    
    try {
        const jobResult = await db.collection('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { returnDocument: 'after' }
        );
        
        jobDetails = jobResult;

        if (!jobDetails) {
            return { message: 'No broadcast jobs to process.' };
        }

        broadcastId = jobDetails._id;
        projectId = jobDetails.projectId;
        
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
            const completionMessage = `Broadcast ${broadcastId} had no pending contacts to send and is now marked as Completed.`;
            await addBroadcastLog(db, broadcastId, projectId, 'WARN', completionMessage);
            return { message: completionMessage };
        }
        
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Found ${contacts.length} pending contacts for broadcast.`);
        
        kafka = new Kafka({ clientId: 'broadcast-producer', brokers: KAFKA_BROKERS });
        producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
        await producer.connect();
        
        let messagesSent = 0;
        for (let i = 0; i < contacts.length; i += KAFKA_MESSAGE_BATCH_SIZE) {
            const batch = contacts.slice(i, i + KAFKA_MESSAGE_BATCH_SIZE);
            const messagePayload = {
                jobDetails: JSON.parse(JSON.stringify(jobDetails)),
                contacts: JSON.parse(JSON.stringify(batch))
            };

            await producer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify(messagePayload) }]
            });
            messagesSent++;
        }

        const successMessage = `Successfully queued ${contacts.length} contacts to Kafka in ${messagesSent} messages for broadcast ${broadcastId}.`;
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', successMessage);
        return { message: successMessage };

    } catch (error: any) {
        const baseErrorMessage = `Broadcast processing failed for job ${broadcastId || 'unknown'}: ${getErrorMessage(error)}`;
        console.error(`[CRON-SCHEDULER] ${baseErrorMessage}`, error.stack);

        if (broadcastId && projectId && db) {
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', baseErrorMessage, { stack: error.stack });
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId, status: 'PROCESSING' },
                { $set: { status: 'Failed', error: baseErrorMessage, completedAt: new Date() } }
            );
        }
        throw new Error(baseErrorMessage);
    } finally {
        if (producer) {
            await producer.disconnect().catch(e => console.error("[CRON-SCHEDULER] Error disconnecting Kafka producer:", e));
        }
    }
}
