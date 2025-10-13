
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka, Partitioners, type Producer } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType, WithId } from './definitions';
import { getErrorMessage } from './utils';

const BATCH_SIZE = 10000;
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const KAFKA_TOPIC = 'messages';

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
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (dbError) {
        console.error("[CRON-SCHEDULER] Database connection failed:", dbError);
        throw new Error("Could not connect to the database.");
    }
    
    let jobDetails: WithId<BroadcastJobType> | null = null;
    let broadcastId: ObjectId | null = null;

    try {
        jobDetails = await db.collection<BroadcastJobType>('broadcasts').findOne({ status: 'QUEUED' });

        if (!jobDetails) {
            console.log('[CRON-SCHEDULER] No broadcast jobs with status QUEUED found.');
            return { message: 'No broadcast jobs to process.' };
        }
        
        broadcastId = jobDetails._id;
        const projectId = jobDetails.projectId;

        // Atomically lock the job to prevent other workers from picking it up
        const lockResult = await db.collection('broadcasts').updateOne(
            { _id: broadcastId, status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } }
        );

        if (lockResult.matchedCount === 0) {
            console.log(`[CRON-SCHEDULER] Broadcast job ${broadcastId} was already picked up by another process. Skipping.`);
            return { message: 'Job already in progress.' };
        }

        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Cron job locked broadcast ${broadcastId} and set status to PROCESSING.`);

        const contacts = await db.collection('broadcast_contacts').find({
            broadcastId: jobDetails._id, // Use the ObjectId here
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

        // --- Kafka Producer Logic ---
        const kafka = new Kafka({ clientId: 'broadcast-producer', brokers: KAFKA_BROKERS });
        const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
        
        try {
            await producer.connect();
            
            const messagePayload = {
                jobDetails: JSON.parse(JSON.stringify(jobDetails)),
                contacts: contacts.map(c => JSON.parse(JSON.stringify(c)))
            };

            await producer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify(messagePayload) }]
            });
            
            const message = `Successfully queued ${contacts.length} contacts to Kafka for broadcast ${broadcastId}.`;
            console.log(`[CRON-SCHEDULER] ${message}`);
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', message);
            return { message };

        } catch (kafkaError) {
            const errorMessage = `Failed to push job ${broadcastId} to Kafka.`;
            console.error(`[CRON-SCHEDULER] ${errorMessage}`, kafkaError);
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMessage, { error: getErrorMessage(kafkaError) });
            // Revert status to QUEUED so it can be retried
            await db.collection('broadcasts').updateOne({ _id: broadcastId }, { $set: { status: 'QUEUED', startedAt: undefined } });
            throw new Error(errorMessage);
        } finally {
            await producer.disconnect().catch(e => console.error("Error disconnecting Kafka producer:", e));
        }
        // --- End Kafka Logic ---

    } catch (error: any) {
        console.error("[CRON-SCHEDULER] Main processing function failed:", error);
        if (broadcastId && jobDetails?.projectId && db) {
            const errorMessage = `Cron Scheduler Error: ${getErrorMessage(error)}`;
            await addBroadcastLog(db, broadcastId, jobDetails.projectId, 'ERROR', errorMessage, { stack: error.stack });
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId }, 
                { $set: { status: 'Failed', error: errorMessage, completedAt: new Date() } }
            );
        }
        throw new Error(`Broadcast processing failed: ${error.message}`);
    }
}
