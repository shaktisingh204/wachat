
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
    // Basic check to see if the producer is still connected. This is not foolproof.
    // A more robust solution might involve a health check endpoint on the producer/broker.
    try {
      // A lightweight operation to check connectivity. This might vary based on the client library.
      // For kafkajs, there isn't a simple "isConnected" check, so we rely on error handling.
      // If it's disconnected, the next `send` will throw an error, and we'll handle it there.
      return producer;
    } catch (e) {
      console.warn('[KAFKA-PRODUCER] Producer connection check failed, will try to reconnect.', e);
      await producer.disconnect().catch(() => {}); // Attempt to clean up
      producer = null; // Force re-creation
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
      producer = null; // Nullify to force re-connection
    });

    return producer;
  } catch (e) {
    console.error('[KAFKA-PRODUCER] Failed to create or connect Kafka producer.', e);
    producer = null; // Ensure we try again next time
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

    try {
        const conn = await connectToDatabase();
        db = conn.db;
        
        const jobResult = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: 'after' }
        );
        
        jobDetails = jobResult;

        if (!jobDetails || !jobDetails._id) {
            return { message: 'No broadcast jobs to process.' };
        }

        const broadcastId = jobDetails._id;
        const projectId = jobDetails.projectId;
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Broadcast job ${broadcastId} picked up for processing.`);

        const contactsCursor = db.collection('broadcast_contacts').find({
            broadcastId: new ObjectId(broadcastId),
            status: 'PENDING'
        });

        let contactBatch: any[] = [];
        let totalPushed = 0;

        for await (const contact of contactsCursor) {
            contactBatch.push(contact);
            if (contactBatch.length >= BATCH_SIZE) {
                const kafkaProducer = await getKafkaProducer();
                
                const serializableJobDetails = {
                    ...jobDetails,
                    _id: jobDetails._id.toString(),
                    projectId: jobDetails.projectId.toString(),
                    ...(jobDetails.templateId && { templateId: jobDetails.templateId.toString() })
                };
                const serializableContacts = contactBatch.map(c => ({...c, _id: c._id.toString(), broadcastId: c.broadcastId.toString()}));
                
                const message = { value: JSON.stringify({ jobDetails: serializableJobDetails, contacts: serializableContacts }) };

                try {
                    await kafkaProducer.send({ topic: KAFKA_TOPIC, messages: [message] });
                    totalPushed += contactBatch.length;
                    await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Pushed batch of ${contactBatch.length} contacts to Kafka.`);
                    contactBatch = [];
                } catch (kafkaError: any) {
                    throw new Error(`Kafka send failed: ${kafkaError.message}`);
                }
            }
        }

        if (contactBatch.length > 0) {
            const kafkaProducer = await getKafkaProducer();
            
             const serializableJobDetails = {
                ...jobDetails,
                _id: jobDetails._id.toString(),
                projectId: jobDetails.projectId.toString(),
                ...(jobDetails.templateId && { templateId: jobDetails.templateId.toString() })
            };
            const serializableContacts = contactBatch.map(c => ({...c, _id: c._id.toString(), broadcastId: c.broadcastId.toString()}));
            
            const message = { value: JSON.stringify({ jobDetails: serializableJobDetails, contacts: serializableContacts }) };
            
            try {
                await kafkaProducer.send({ topic: KAFKA_TOPIC, messages: [message] });
                totalPushed += contactBatch.length;
                await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Pushed final batch of ${contactBatch.length} contacts to Kafka.`);
            } catch (kafkaError: any) {
                 throw new Error(`Kafka send failed on final batch: ${kafkaError.message}`);
            }
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
        return { message };

    } catch (error: any) {
        console.error("[KAFKA-PRODUCER] Main processing function failed:", error);
        if (jobDetails && jobDetails._id && jobDetails.projectId && db) {
            const errorMessage = `Producer Error: ${error.message}`;
            await addBroadcastLog(db, jobDetails._id, jobDetails.projectId, 'ERROR', errorMessage, { stack: error.stack });
            await db.collection('broadcasts').updateOne(
                { _id: jobDetails._id }, 
                { $set: { status: 'Failed', error: errorMessage, completedAt: new Date() } }
            );
        }
        throw new Error(`Broadcast Kafka producer failed: ${error.message}`);
    }
}
