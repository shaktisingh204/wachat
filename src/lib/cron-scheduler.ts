
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka, Partitioners, type Producer } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType } from './definitions';

const BATCH_SIZE = 10000;
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const KAFKA_TOPIC = 'messages';

let kafka: Kafka | null = null;
let producer: Producer | null = null;

async function getKafkaProducer(): Promise<Producer> {
  if (producer) {
    return producer;
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
        retries: 8
      }
    });

    const newProducer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });

    console.log('[KAFKA-PRODUCER] Connecting to Kafka...');
    await newProducer.connect();
    console.log('[KAFKA-PRODUCER] Kafka Producer connected successfully.');
    
    newProducer.on(newProducer.events.DISCONNECT, () => {
      console.error('[KAFKA-PRODUCER] Kafka Producer disconnected. Will attempt to reconnect on next job.');
      producer = null; // Set to null to force re-creation on next call
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
    
    let jobDetails: BroadcastJobType | null = null;

    try {
        const findAndLockResult = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: 'after' }
        );

        jobDetails = findAndLockResult;

        if (!jobDetails) {
            return { message: 'No broadcast jobs to process.' };
        }

        const { _id: broadcastId, projectId } = jobDetails;
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Cron job picked up broadcast ${broadcastId} and set status to PROCESSING.`);

        const contactsCursor = db.collection('broadcast_contacts').find({
            broadcastId: broadcastId,
            status: 'PENDING'
        });

        let kafkaProducer;
        try {
            kafkaProducer = await getKafkaProducer();
        } catch(e: any) {
            throw new Error(`Failed to connect to Kafka: ${e.message}`);
        }

        let contactBatch: any[] = [];
        let totalPushed = 0;
        
        for await (const contact of contactsCursor) {
            contactBatch.push(contact);
            if (contactBatch.length >= BATCH_SIZE) {
                const serializableJobDetails = { ...jobDetails, _id: jobDetails._id.toString(), projectId: jobDetails.projectId.toString(), templateId: jobDetails.templateId?.toString() };
                const serializableContacts = contactBatch.map(c => ({...c, _id: c._id.toString(), broadcastId: c.broadcastId.toString()}));
                
                await kafkaProducer.send({ topic: KAFKA_TOPIC, messages: [{ value: JSON.stringify({ jobDetails: serializableJobDetails, contacts: serializableContacts }) }] });
                totalPushed += contactBatch.length;
                await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Pushed batch of ${contactBatch.length} contacts to Kafka.`);
                contactBatch = [];
            }
        }

        if (contactBatch.length > 0) {
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
        if (jobDetails?._id && jobDetails?.projectId && db) {
            const errorMessage = `Cron Scheduler Error: ${error.message}`;
            await addBroadcastLog(db, jobDetails._id, jobDetails.projectId, 'ERROR', errorMessage, { stack: error.stack });
            await db.collection('broadcasts').updateOne(
                { _id: jobDetails._id }, 
                { $set: { status: 'Failed', error: errorMessage, completedAt: new Date() } }
            );
        }
        throw new Error(`Broadcast processing failed: ${error.message}`);
    }
}
