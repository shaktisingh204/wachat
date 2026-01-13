
'use server';

import { connectToDatabase } from './mongodb';
import { getErrorMessage } from './utils';
import { Kafka, Partitioners } from 'kafkajs';
import type { Broadcast } from './definitions';
import { ObjectId } from 'mongodb';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'];
const LOG_PREFIX = '[CRON-SCHEDULER]';
const KAFKA_TOPIC = 'broadcasts';

const CHUNK_SIZE = 1000; // Number of contacts per Kafka message

let kafka: Kafka | null = null;
let producer: any = null;

async function getProducer() {
    if (!kafka) {
        kafka = new Kafka({
            clientId: 'sabnode-broadcast-producer',
            brokers: KAFKA_BROKERS,
            // Adjust retry settings for more resilience if needed
            retry: {
                initialRetryTime: 300,
                retries: 5,
            },
        });
    }

    if (producer) {
        try {
            // A simple check to see if the producer is still connected
            await kafka.producer().connect();
            return kafka.producer();
        } catch (e) {
            // If connection fails, create a new one
            console.warn(`${LOG_PREFIX} Kafka producer connection lost. Reconnecting...`);
            producer = null; // Force recreation
        }
    }
    
    producer = kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
        idempotent: true, // Ensures messages are written exactly once
        maxInFlightRequests: 1, // Ensures messages are sent in order
    });

    await producer.connect();
    return producer;
}

export async function processBroadcastJob() {
    console.log(`${LOG_PREFIX} Starting broadcast processing job...`);
    const { db } = await connectToDatabase();
    
    try {
        const queuedBroadcasts = await db.collection<Broadcast>('broadcasts').find({
            status: 'QUEUED'
        }).toArray();

        if (queuedBroadcasts.length === 0) {
            return { message: 'No queued broadcasts to process.' };
        }

        const kafkaProducer = await getProducer();
        
        for (const broadcast of queuedBroadcasts) {
            const broadcastId = broadcast._id;
            console.log(`${LOG_PREFIX} Processing broadcast ${broadcastId}...`);

            // Mark as processing to prevent re-picking
            await db.collection('broadcasts').updateOne(
                { _id: broadcastId },
                { $set: { status: 'PROCESSING', startedAt: new Date() } }
            );

            const contactsCursor = db.collection('broadcast_contacts').find({
                broadcastId: broadcastId,
                status: 'PENDING'
            });

            let contactChunk = [];
            
            while(await contactsCursor.hasNext()) {
                const contact = await contactsCursor.next();
                if(contact) {
                    contactChunk.push(contact);
                }

                if (contactChunk.length >= CHUNK_SIZE) {
                    await kafkaProducer.send({
                        topic: KAFKA_TOPIC,
                        messages: [{ value: JSON.stringify({ jobDetails: broadcast, contacts: contactChunk }) }],
                    });
                    contactChunk = []; // Reset chunk
                }
            }

            // Send any remaining contacts in the last chunk
            if (contactChunk.length > 0) {
                 await kafkaProducer.send({
                    topic: KAFKA_TOPIC,
                    messages: [{ value: JSON.stringify({ jobDetails: broadcast, contacts: contactChunk }) }],
                });
            }
             console.log(`${LOG_PREFIX} Broadcast ${broadcastId} has been fully queued into Kafka.`);
        }

        return { message: `Successfully queued ${queuedBroadcasts.length} broadcast(s).` };

    } catch (e: any) {
        console.error(`${LOG_PREFIX} Error during broadcast processing:`, e);
        return { error: getErrorMessage(e) };
    }
}
