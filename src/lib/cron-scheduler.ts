
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
    if (producer && producer.connection) {
        return producer;
    }

    if (!process.env.KAFKA_BROKERS) {
        console.error('[KAFKA-PRODUCER] FATAL: KAFKA_BROKERS environment variable is not set. Producer cannot start.');
        throw new Error('KAFKA_BROKERS not set');
    }

    kafka = new Kafka({
      clientId: 'broadcast-producer',
      brokers: KAFKA_BROKERS,
    });

    producer = kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
    });

    await producer.connect();
    return producer;
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
    let broadcastId: ObjectId | undefined;
    let projectId: ObjectId | undefined;

    try {
        const conn = await connectToDatabase();
        db = conn.db;
        
        const jobDetails = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: 'after' } // **CRITICAL FIX HERE**
        );
        
        if (!jobDetails || !jobDetails._id) {
            console.log("[KAFKA-PRODUCER] No broadcast jobs to process.");
            return { message: 'No broadcast jobs to process.' };
        }

        broadcastId = jobDetails._id;
        projectId = jobDetails.projectId;
        await addBroadcastLog(db, broadcastId, projectId, 'INFO', 'Broadcast job picked up for processing.');

        const kafkaProducer = await getKafkaProducer();

        const contactsCursor = db.collection('broadcast_contacts').find({
            broadcastId: new ObjectId(broadcastId),
            status: 'PENDING'
        });

        let contactBatch = [];
        let totalPushed = 0;

        for await (const contact of contactsCursor) {
            contactBatch.push(contact);
            if (contactBatch.length >= BATCH_SIZE) {
                const serializableJobDetails = {
                    ...jobDetails,
                    _id: jobDetails._id.toString(),
                    projectId: jobDetails.projectId.toString(),
                    ...(jobDetails.templateId && { templateId: jobDetails.templateId.toString() })
                };
                const serializableContacts = contactBatch.map(c => ({...c, _id: c._id.toString(), broadcastId: c.broadcastId.toString()}));
                
                const message = { value: JSON.stringify({ jobDetails: serializableJobDetails, contacts: serializableContacts }) };
                await kafkaProducer.send({ topic: KAFKA_TOPIC, messages: [message] });
                totalPushed += contactBatch.length;
                await addBroadcastLog(db, broadcastId, projectId, 'INFO', `Pushed batch of ${contactBatch.length} contacts to Kafka.`);
                contactBatch = [];
            }
        }

        if (contactBatch.length > 0) {
             const serializableJobDetails = {
                ...jobDetails,
                _id: jobDetails._id.toString(),
                projectId: jobDetails.projectId.toString(),
                ...(jobDetails.templateId && { templateId: jobDetails.templateId.toString() })
            };
            const serializableContacts = contactBatch.map(c => ({...c, _id: c._id.toString(), broadcastId: c.broadcastId.toString()}));
            
            const message = { value: JSON.stringify({ jobDetails: serializableJobDetails, contacts: serializableContacts }) };
            await kafkaProducer.send({ topic: KAFKA_TOPIC, messages: [message] });
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
        return { message };

    } catch (error: any) {
        console.error("[KAFKA-PRODUCER] Main processing function failed:", error);
        if (broadcastId && projectId && db) {
            const errorMessage = `Producer Error: ${error.message}`;
            await addBroadcastLog(db, broadcastId, projectId, 'ERROR', errorMessage, { stack: error.stack });
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId }, 
                { $set: { status: 'Failed', error: errorMessage } }
            );
        }
        throw new Error(`Broadcast Kafka producer failed: ${error.message}`);
    }
}
