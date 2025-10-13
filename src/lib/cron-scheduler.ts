
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

let kafka;
let producer;

async function getKafkaProducer() {
    if (producer) return producer;

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

/**
 * The main function for processing broadcast jobs. It now acts as a Kafka producer.
 * It pulls a queued job, reads its contacts, and pushes them in batches to a Kafka topic.
 */
export async function processBroadcastJob() {
    let db: Db;
    let broadcastId: ObjectId | undefined;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
        

        const jobDetails = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: 'after' } // FIFO
        );
        
        if (!jobDetails || !jobDetails._id) {
            console.log("[KAFKA-PRODUCER] No broadcast jobs to process.");
            return { message: 'No broadcast jobs to process.' };
        }

        broadcastId = jobDetails._id;
        console.log(`[KAFKA-PRODUCER] Starting to process broadcast: ${broadcastId}`);

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
                const message = {
                    value: JSON.stringify({ jobDetails, contacts: contactBatch })
                };
                await kafkaProducer.send({
                    topic: KAFKA_TOPIC,
                    messages: [message],
                });
                totalPushed += contactBatch.length;
                console.log(`[KAFKA-PRODUCER] Pushed batch of ${contactBatch.length} contacts for broadcast ${broadcastId}.`);
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
            console.log(`[KAFKA-PRODUCER] Pushed final batch of ${contactBatch.length} contacts for broadcast ${broadcastId}.`);
        }

        if (totalPushed === 0) {
            // This is the crucial check: if the job was marked PROCESSING but no contacts were found,
            // it means the job is actually complete or was created without contacts.
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId },
                { 
                    $set: { 
                        status: 'Completed', 
                        completedAt: new Date(),
                        error: null // Clear any previous errors
                    } 
                }
            );
            const completionMessage = `Broadcast ${broadcastId} had no pending contacts to send and is now marked as Completed.`;
            console.log(`[KAFKA-PRODUCER] ${completionMessage}`);
            return { message: completionMessage };
        }


        const message = `Successfully queued ${totalPushed} contacts to Kafka for broadcast ${broadcastId}.`;
        console.log(`[KAFKA-PRODUCER] ${message}`);
        return { message };

    } catch (error: any) {
        console.error("[KAFKA-PRODUCER] Main processing function failed:", error);
        if (broadcastId && db) {
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId }, 
                { 
                    $set: { 
                        status: 'Failed', 
                        error: `Producer Error: ${error.message}` 
                    } 
                }
            );
        }
        throw new Error(`Broadcast Kafka producer failed: ${error.message}`);
    }
}
