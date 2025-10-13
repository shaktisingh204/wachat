
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka, Partitioners } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType } from './definitions';

const BATCH_SIZE = 10000;
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const KAFKA_TOPIC = 'messages';

let kafka: Kafka | null = null;
let producer: any = null;

async function getKafkaProducer() {
  if (producer) {
    try {
      // A lightweight check could be to get cluster metadata, but for now we'll rely on send error handling.
      // If send fails, we'll assume disconnection and the logic below will handle it.
      return producer;
    } catch (e) {
      console.warn('[KAFKA-PRODUCER] Producer connection check failed, will try to reconnect.', e);
      try {
        await producer.disconnect();
      } catch (disconnectErr) {
        console.error('[KAFKA-PRODUCER] Error during graceful disconnect:', disconnectErr);
      }
      producer = null;
    }
  }

  if (!process.env.KAFKA_BROKERS) {
    console.error('[KAFKA-PRODUCER] FATAL: KAFKA_BROKERS environment variable is not set. Producer cannot start.');
    throw new Error('KAFKA_BROKERS not set');
  }

  try {
    kafka = new Kafka({
      clientId: 'broadcast-producer',
      brokers: KAFKA_BROKERS,
      retry: {
        initialRetryTime: 300,
        retries: 5
      }
    });

    producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });

    console.log('[KAFKA-PRODUCER] Connecting to Kafka...');
    await producer.connect();
    console.log('[KAFKA-PRODUCER] Kafka Producer connected successfully.');
    
    producer.on('disconnect', () => {
      console.error('[KAFKA-PRODUCER] Kafka Producer disconnected. Will attempt to reconnect on next job.');
      producer = null;
    });

    return producer;
  } catch (e) {
    console.error('[KAFKA-PRODUCER] Failed to create or connect Kafka producer.', e);
    producer = null; // Ensure producer is null on failure
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
    let jobDetails: BroadcastJobType | null = null;
    let broadcastId: ObjectId | null = null;
    let projectId: ObjectId | null = null;

    try {
        const conn = await connectToDatabase();
        db = conn.db;
        console.log('[CRON-SCHEDULER] Database connection successful.');

        // Step 1: Find a single queued job
        jobDetails = await db.collection<BroadcastJobType>('broadcasts').findOne(
            { status: 'QUEUED' },
            { sort: { createdAt: 1 } }
        );

        if (!jobDetails) {
            console.log("[CRON-SCHEDULER] No 'QUEUED' broadcast jobs found to process.");
            return { message: 'No broadcast jobs to process.' };
        }
        
        broadcastId = jobDetails._id;
        projectId = jobDetails.projectId;
        console.log(`[CRON-SCHEDULER] Found job ${broadcastId}. Attempting to lock.`);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Cron job picked up broadcast ${broadcastId}.`);


        // Step 2: Atomically update its status to 'PROCESSING' to "lock" it
        const updateResult = await db.collection('broadcasts').updateOne(
            { _id: broadcastId, status: 'QUEUED' }, // Ensure we only update if it's still queued
            { $set: { status: 'PROCESSING', startedAt: new Date() } }
        );

        if (updateResult.modifiedCount === 0) {
            console.log(`[CRON-SCHEDULER] Job ${broadcastId} was picked up by another process. Skipping.`);
            return { message: `Job ${broadcastId} was already processed.` };
        }
        
        console.log(`[CRON-SCHEDULER] Job ${broadcastId} locked. Fetching contacts.`);
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Job status updated to PROCESSING. Fetching pending contacts.`);


        // Step 3: Fetch pending contacts for the locked job
        const contactsCursor = db.collection('broadcast_contacts').find({
            broadcastId: broadcastId,
            status: 'PENDING'
        });

        let contactBatch: any[] = [];
        let totalPushed = 0;

        for await (const contact of contactsCursor) {
            contactBatch.push(contact);
            if (contactBatch.length >= BATCH_SIZE) {
                const kafkaProducer = await getKafkaProducer();
                
                const serializableJobDetails = { ...jobDetails, _id: jobDetails._id.toString(), projectId: jobDetails.projectId.toString(), templateId: jobDetails.templateId?.toString() };
                const serializableContacts = contactBatch.map(c => ({...c, _id: c._id.toString(), broadcastId: c.broadcastId.toString()}));
                
                await kafkaProducer.send({ topic: KAFKA_TOPIC, messages: [{ value: JSON.stringify({ jobDetails: serializableJobDetails, contacts: serializableContacts }) }] });
                totalPushed += contactBatch.length;
                await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Pushed batch of ${contactBatch.length} contacts to Kafka.`);
                contactBatch = [];
            }
        }

        if (contactBatch.length > 0) {
            const kafkaProducer = await getKafkaProducer();
            
            const serializableJobDetails = { ...jobDetails, _id: jobDetails._id.toString(), projectId: jobDetails.projectId.toString(), templateId: jobDetails.templateId?.toString() };
            const serializableContacts = contactBatch.map(c => ({...c, _id: c._id.toString(), broadcastId: c.broadcastId.toString()}));
            
            await kafkaProducer.send({ topic: KAFKA_TOPIC, messages: [{ value: JSON.stringify({ jobDetails: serializableJobDetails, contacts: serializableContacts }) }] });
            totalPushed += contactBatch.length;
            await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Pushed final batch of ${contactBatch.length} contacts to Kafka.`);
        }

        if (totalPushed === 0) {
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId },
                { $set: { status: 'Completed', completedAt: new Date() } }
            );
            const completionMessage = `Broadcast ${broadcastId} had no pending contacts to send and is now marked as Completed.`;
            await addBroadcastLog(db, broadcastId, projectId, 'WARN', completionMessage);
            return { message: completionMessage };
        }

        const message = `Successfully queued ${totalPushed} contacts to Kafka for broadcast ${broadcastId}.`;
        console.log(`[CRON-SCHEDULER] ${message}`);
        return { message };

    } catch (error: any) {
        console.error("[CRON-SCHEDULER] Main processing function failed:", error);
        if (broadcastId && projectId && db) {
            const errorMessage = `Cron Scheduler Error: ${error.message}`;
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMessage, { stack: error.stack });
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId }, 
                { $set: { status: 'Failed', error: errorMessage, completedAt: new Date() } }
            );
        }
        // Re-throw the error to ensure the calling context knows about the failure.
        throw new Error(`Broadcast processing failed: ${error.message}`);
    }
}
