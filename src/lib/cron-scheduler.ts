
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Kafka } from 'kafkajs';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType } from './definitions';

const BATCH_SIZE = 10000;
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || '127.0.0.1:9092'];
const KAFKA_TOPIC = 'messages';

let kafka;
let producer;

async function getKafkaProducer() {
    if (producer) return producer;

    kafka = new Kafka({
      clientId: 'broadcast-producer',
      brokers: KAFKA_BROKERS,
    });

    producer = kafka.producer({
        acks: 1, 
    });

    await producer.connect();
    return producer;
}

/**
 * The main function for processing broadcast jobs. It now acts as a Kafka producer.
 * It pulls a queued job, reads its contacts, and pushes them in batches to a Kafka topic.
 */
export async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
        const kafkaProducer = await getKafkaProducer();

        const jobDetails = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!jobDetails) {
            return { message: 'No broadcast jobs to process.' };
        }

        console.log(`[KAFKA-PRODUCER] Starting to process broadcast: ${jobDetails._id}`);
        const broadcastId = jobDetails._id;

        const contactsCursor = db.collection('broadcast_contacts').find({
            broadcastId: new ObjectId(broadcastId),
            status: 'PENDING'
        });

        let contactBatch = [];
        let totalPushed = 0;

        for await (const contact of contactsCursor) {
            contactBatch.push(contact);
            if (contactBatch.length >= BATCH_SIZE) {
                const message = {
                    value: JSON.stringify({ jobDetails, contacts: contactBatch })
                };
                await kafkaProducer.send({
                    topic: KAFKA_TOPIC,
                    messages: [message],
                });
                totalPushed += contactBatch.length;
                contactBatch = [];
            }
        }

        if (contactBatch.length > 0) {
            const message = {
                value: JSON.stringify({ jobDetails, contacts: contactBatch })
            };
            await kafkaProducer.send({
                topic: KAFKA_TOPIC,
                messages: [message],
            });
            totalPushed += contactBatch.length;
        }

        const message = `Successfully pushed ${totalPushed} contacts to Kafka for broadcast ${broadcastId}.`;
        console.log(`[KAFKA-PRODUCER] ${message}`);
        
        // If no contacts were pushed, the job is effectively done.
        if (totalPushed === 0) {
            await db.collection('broadcasts').updateOne({ _id: broadcastId }, { $set: { status: 'Completed', completedAt: new Date() } });
        }

        return { message };

    } catch (error: any) {
        console.error("[KAFKA-PRODUCER] Main processing function failed:", error);
        throw new Error(`Broadcast Kafka producer failed: ${error.message}`);
    }
}
