

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

async function getKafkaProducer(): Promise<Producer> {
  if (producer) {
    try {
      // A quick check to see if the producer is still connected
      await kafka!.admin().describeCluster();
      return producer;
    } catch (e) {
      console.warn('[KAFKA-PRODUCER] Producer seems disconnected. Attempting to reconnect.');
      await producer.disconnect().catch(err => console.error("Error during forced disconnect:", err));
      producer = null;
    }
  }

  if (!process.env.KAFKA_BROKERS) {
    console.error('[KAFKA-PRODUCER] FATAL: KAFKA_BROKERS environment variable is not set.');
    throw new Error('KAFKA_BROKERS not set');
  }

  try {
    kafka = new Kafka({
      clientId: 'broadcast-producer',
      brokers: KAFKA_BROKERS,
      retry: { initialRetryTime: 300, retries: 8 }
    });

    const newProducer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    console.log('[KAFKA-PRODUCER] Connecting to Kafka...');
    await newProducer.connect();
    console.log('[KAFKA-PRODUCER] Kafka Producer connected successfully.');
    
    newProducer.on(newProducer.events.DISCONNECT, () => {
      console.error('[KAFKA-PRODUCER] Kafka Producer disconnected. Will attempt to reconnect on next job.');
      producer = null;
    });

    producer = newProducer;
    return producer;
  } catch (e) {
    console.error('[KAFKA-PRODUCER] Failed to create or connect Kafka producer.', e);
    if (producer) {
        await producer.disconnect().catch((err: any) => console.error("Failed to disconnect errored producer", err));
    }
    producer = null;
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

    try {
        // Step 1: Find a single QUEUED job.
        const queuedJob = await db.collection<BroadcastJobType>('broadcasts').findOne({ status: 'QUEUED' });

        if (!queuedJob) {
            console.log('[CRON-SCHEDULER] No broadcast jobs with status QUEUED found.');
            return { message: 'No broadcast jobs to process.' };
        }
        
        // Step 2: Atomically "lock" this specific job by its unique _id.
        const lockResult = await db.collection('broadcasts').updateOne(
            { _id: queuedJob._id, status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } }
        );

        if (lockResult.matchedCount === 0) {
            console.log(`[CRON-SCHEDULER] Job ${queuedJob._id} was picked up by another process. Skipping.`);
            return { message: `Job ${queuedJob._id} was processed by another worker.` };
        }
        
        jobDetails = await db.collection<WithId<BroadcastJobType>>('broadcasts').findOne({ _id: queuedJob._id });
        if (!jobDetails) throw new Error("Failed to re-fetch job after locking.");

        const broadcastId = jobDetails._id;
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

        // The job details object needs to be stringifiable for Kafka.
        // We ensure all BSON types like ObjectId are converted to strings.
        const serializableJobDetails = { 
            ...jobDetails, 
            _id: jobDetails._id.toString(),
            projectId: jobDetails.projectId.toString(),
            templateId: jobDetails.templateId?.toString()
        };

        const messagePayload = {
            jobDetails: serializableJobDetails,
            contacts: contacts.map(c => ({...c, _id: c._id.toString(), broadcastId: c.broadcastId.toString()}))
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
        if (jobDetails?._id && jobDetails?.projectId && db) {
            const errorMessage = `Cron Scheduler Error: ${getErrorMessage(error)}`;
            await addBroadcastLog(db, jobDetails._id, jobDetails.projectId, 'ERROR', errorMessage, { stack: error.stack });
            await db.collection('broadcasts').updateOne(
                { _id: jobDetails._id }, 
                { $set: { status: 'Failed', error: errorMessage, completedAt: new Date() } }
            );
        }
        throw new Error(`Broadcast processing failed: ${error.message}`);
    }
}
