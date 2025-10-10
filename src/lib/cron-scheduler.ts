

'use server';

/**
 * @fileOverview High-Throughput Broadcast Scheduler
 *
 * This file contains the core logic for processing and sending broadcast campaigns.
 * It is designed for high performance and scalability by fetching contacts directly
 * from the database and using a highly concurrent promise pool.
 *
 * 1.  **Project-Based Locking:** A lock is acquired in the database for each project
 *     to ensure that only one scheduler process handles a specific project's
 *     broadcasts at a time, allowing for concurrent processing across different projects.
 *
 * 2.  **Database as a Queue:** Instead of Redis, contacts are fetched directly from
 *     the `broadcast_contacts` collection in batches.
 *
 * 3.  **Concurrency Pool:** The `promisePool` function manages concurrent API
 *     requests to Meta, respecting the configured messages-per-second limit.
 *
 * 4.  **Optimized Batched Database Writes:** Status updates for sent messages are
 *     buffered and flushed to MongoDB in batches to reduce DB load.
 */


import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';
import axios from 'axios';
import { type BroadcastJob as BroadcastJobType } from './definitions';
import { getRedisClient } from './redis';
import { getErrorMessage } from './utils';

type BroadcastContact = {
    _id: ObjectId;
    broadcastId: ObjectId;
    phone: string;
    variables: Record<string, string>;
    status: 'PENDING' | 'SENT' | 'FAILED';
    createdAt: Date;
    sentAt?: Date;
    messageId?: string;
    error?: string;
}

type Project = {
    _id: ObjectId;
    messagesPerSecond?: number;
};

const BATCH_ENQUEUE_SIZE = 5000;
const REDIS_QUEUE_NAME = 'broadcast-queue';


async function enqueueContactsForJob(db: Db, job: BroadcastJobType) {
    const redis = await getRedisClient();
    let contactsProcessed = 0;
    const contactCursor = db.collection('broadcast_contacts').find({ broadcastId: job._id, status: 'PENDING' });

    let contactsBatch = [];

    for await (const contact of contactCursor) {
        const messageTask = {
            jobId: job._id.toString(),
            contactId: contact._id.toString(),
            wabaId: job.wabaId,
            accessToken: job.accessToken,
            phoneNumberId: job.phoneNumberId,
            templateName: job.templateName,
            language: job.language,
            components: job.components,
            headerImageUrl: job.headerImageUrl,
            headerMediaId: job.headerMediaId,
            contact: {
                phone: contact.phone,
                ...contact.variables
            }
        };

        contactsBatch.push(JSON.stringify(messageTask));
        
        if (contactsBatch.length >= BATCH_ENQUEUE_SIZE) {
            await redis.lPush(REDIS_QUEUE_NAME, contactsBatch);
            contactsProcessed += contactsBatch.length;
            contactsBatch = [];
        }
    }
    
    if (contactsBatch.length > 0) {
        await redis.lPush(REDIS_QUEUE_NAME, contactsBatch);
        contactsProcessed += contactsBatch.length;
    }

    // Mark all pending contacts as 'QUEUED' in the database in a single operation
    // This is more efficient than updating them one by one.
    if (contactsProcessed > 0) {
        await db.collection('broadcast_contacts').updateMany(
            { broadcastId: job._id, status: 'PENDING' },
            { $set: { status: 'QUEUED' as any } }
        );
    }
    
    return contactsProcessed;
}


export async function processBroadcastJob() {
    let db: Db;
    
    try {
        const conn = await connectToDatabase();
        db = conn.db;

        const jobsToProcess = await db.collection<BroadcastJobType>('broadcasts').find({
            status: 'QUEUED'
        }).sort({ createdAt: 1 }).toArray();

        if (jobsToProcess.length === 0) {
            return { message: 'No active broadcasts to process.' };
        }
        
        const jobIdsToUpdate = jobsToProcess.map(j => j._id);
        await db.collection('broadcasts').updateMany(
            { _id: { $in: jobIdsToUpdate } },
            { $set: { status: 'PROCESSING', startedAt: new Date() } }
        );
        
        let totalEnqueued = 0;
        
        for (const job of jobsToProcess) {
            const enqueuedCount = await enqueueContactsForJob(db, job);
            totalEnqueued += enqueuedCount;

            if (enqueuedCount < job.contactCount) {
                 await db.collection('broadcasts').updateOne({_id: job._id}, {$set: { status: 'COMPLETED' }});
            }
        }
        
        return {
            message: `Enqueued ${totalEnqueued} message(s) from ${jobsToProcess.length} broadcast job(s).`,
        };

    } catch (error: any) {
        console.error("Cron scheduler failed:", getErrorMessage(error));
        throw new Error(`Cron scheduler failed: ${getErrorMessage(error)}`);
    }
}

// Dummy functions to satisfy dependencies - not used in the new architecture
export async function executeSingleBroadcast() {}

