
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

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let isConnecting = false;
let isConnected = false;

async function getKafkaProducer(): Promise<Producer> {
  if (producer && isConnected) {
    return producer;
  }

  if (isConnecting) {
    // Wait for the existing connection attempt to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (producer && isConnected) return producer;
    throw new Error('Kafka producer is still connecting from a previous attempt.');
  }

  if (!process.env.KAFKA_BROKERS) {
    console.error('[KAFKA-PRODUCER] FATAL: KAFKA_BROKERS environment variable is not set.');
    throw new Error('KAFKA_BROKERS not set');
  }

  isConnecting = true;

  try {
    if (producer) {
        await producer.disconnect().catch(err => console.error("Error during producer cleanup:", err));
        producer = null;
        isConnected = false;
    }

    kafka = new Kafka({
      clientId: 'broadcast-producer',
      brokers: KAFKA_BROKERS,
      retry: { initialRetryTime: 300, retries: 8 }
    });

    const newProducer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

    newProducer.on(newProducer.events.CONNECT, () => {
        console.log('[KAFKA-PRODUCER] Kafka Producer connected successfully.');
        isConnected = true;
    });

    newProducer.on(newProducer.events.DISCONNECT, () => {
      console.error('[KAFKA-PRODUCER] Kafka Producer disconnected. Will attempt to reconnect on next job.');
      isConnected = false;
      producer = null;
    });

    await newProducer.connect();
    producer = newProducer;
    isConnecting = false;
    return producer;
  } catch (e) {
    console.error('[KAFKA-PRODUCER] Failed to create or connect Kafka producer.', e);
    if (producer) {
        await producer.disconnect().catch((err: any) => console.error("Failed to disconnect errored producer", err));
    }
    producer = null;
    isConnected = false;
    isConnecting = false;
    throw e;
  }
}

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
        // Step 1: Find a single QUEUED job.
        const jobResult = await db.collection('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { returnDocument: 'after' }
        );

        jobDetails = jobResult; // In MongoDB 5+, findOneAndUpdate returns the document directly

        if (!jobDetails) {
            console.log('[CRON-SCHEDULER] No broadcast jobs with status QUEUED found.');
            return { message: 'No broadcast jobs to process.' };
        }
        
        broadcastId = jobDetails._id;
        const projectId = jobDetails.projectId;
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Cron job picked up broadcast ${broadcastId} and set status to PROCESSING.`);

        // Step 3: Fetch contacts for the locked job.
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

        let kafkaProducer;
        try {
            kafkaProducer = await getKafkaProducer();
        } catch(e: any) {
            throw new Error(`Failed to connect to Kafka: ${e.message}`);
        }

        const serializableJobDetails = JSON.parse(JSON.stringify(jobDetails));

        const messagePayload = {
            jobDetails: serializableJobDetails,
            contacts: contacts.map(c => JSON.parse(JSON.stringify(c)))
        };

        try {
            await kafkaProducer.send({
                topic: KAFKA_TOPIC,
                messages: [{ value: JSON.stringify(messagePayload) }]
            });
        } catch (kafkaError) {
             const errorMessage = `Failed to push job ${broadcastId} to Kafka.`;
             console.error(`[CRON-SCHEDULER] ${errorMessage}`, kafkaError);
             await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMessage, { error: getErrorMessage(kafkaError) });
             // Revert status to QUEUED so it can be retried
             await db.collection('broadcasts').updateOne({ _id: broadcastId }, { $set: { status: 'QUEUED' } });
             throw new Error(errorMessage);
        }

        const message = `Successfully queued ${contacts.length} contacts to Kafka for broadcast ${broadcastId}.`;
        console.log(`[CRON-SCHEDULER] ${message}`);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', message);
        return { message };

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
