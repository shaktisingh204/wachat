
'use server';

/**
 * @fileOverview High-Throughput Broadcast Job Producer
 *
 * This file is now solely responsible for producing jobs. It fetches a queued broadcast,
 * breaks its contacts into smaller micro-batches, and pushes those micro-batches
 * into a Redis queue. Dedicated worker processes will consume jobs from this queue.
 */

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redis';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType } from './definitions';

const BATCH_SIZE = 1000;

/**
 * The main function for processing broadcast jobs. It pulls jobs from the database and pushes them to Redis.
 */
export async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
        const redis = await getRedisClient();

        // Find one 'QUEUED' broadcast job
        const jobDetails = await db.collection<BroadcastJobType>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', startedAt: new Date() } }
        );

        if (!jobDetails) {
            return { message: 'No broadcast jobs to process.' };
        }

        console.log(`[Producer] Starting to process broadcast: ${jobDetails._id}`);
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
                const jobString = JSON.stringify({ jobDetails, contacts: contactBatch });
                await redis.lPush('broadcast-queue', jobString);
                totalPushed += contactBatch.length;
                contactBatch = [];
            }
        }

        if (contactBatch.length > 0) {
            const jobString = JSON.stringify({ jobDetails, contacts: contactBatch });
            await redis.lPush('broadcast-queue', jobString);
            totalPushed += contactBatch.length;
        }

        const message = `Successfully queued ${totalPushed} contacts for broadcast ${broadcastId}.`;
        console.log(`[Producer] ${message}`);
        
        // If no contacts were pushed, it means the job is done.
        if (totalPushed === 0) {
            await db.collection('broadcasts').updateOne({ _id: broadcastId }, { $set: { status: 'Completed', completedAt: new Date() } });
        }

        return { message };

    } catch (error: any) {
        console.error("[Producer] Main processing function failed:", error);
        // Optionally, re-queue the job if it fails during this stage
        // if (db && jobDetails) {
        //     await db.collection('broadcasts').updateOne({ _id: jobDetails._id }, { $set: { status: 'QUEUED' } });
        // }
        throw new Error(`Broadcast producer failed: ${error.message}`);
    }
}
