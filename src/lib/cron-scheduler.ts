'use server';

/**
 * @fileOverview High-Throughput Broadcast Scheduler (Producer)
 *
 * This cron job now acts as the "Producer" in a producer-consumer pattern.
 * Its primary responsibility is to:
 * 1. Find projects with broadcasts in the 'QUEUED' state.
 * 2. Acquire a project-level lock.
 * 3. Stream 'PENDING' contacts from MongoDB.
 * 4. Break them into smaller micro-batches and push them as jobs into a Redis queue.
 * 5. Update the broadcast status to 'PROCESSING'.
 */

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redis';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType } from './definitions';
import { getErrorMessage } from './utils';

const MICRO_BATCH_SIZE = 100; // Number of contacts per job in Redis queue
const JOB_EXPIRATION_SECONDS = 60 * 30; // 30 minutes

export async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;

        const projectsWithQueuedJobs = await db.collection('broadcasts').distinct('projectId', { status: 'QUEUED' });
        if (projectsWithQueuedJobs.length === 0) {
            return { message: 'No active broadcasts to enqueue.' };
        }

        let totalEnqueued = 0;
        let jobsCreated = 0;

        for (const projectId of projectsWithQueuedJobs) {
            const lockAcquired = await db.collection('projects').findOneAndUpdate(
                { _id: projectId, lock: { $ne: true } },
                { $set: { lock: true, lockTimestamp: new Date() } }
            );

            if (!lockAcquired) {
                console.log(`[Producer] Project ${projectId} is locked. Skipping.`);
                continue;
            }

            try {
                const job = await db.collection<BroadcastJobType>('broadcasts').findOne({
                    projectId: projectId,
                    status: 'QUEUED'
                }, { sort: { createdAt: 1 } });
                
                if (!job) {
                    await db.collection('projects').updateOne({ _id: projectId }, { $set: { lock: false }, $unset: { lockTimestamp: '' } });
                    continue;
                }

                await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'PROCESSING', startedAt: new Date() } });
                jobsCreated++;
                
                const redis = await getRedisClient();
                const contactCursor = db.collection('broadcast_contacts').find({ broadcastId: job._id, status: 'PENDING' });
                
                let microBatch = [];
                for await (const contact of contactCursor) {
                    microBatch.push(contact);
                    if (microBatch.length >= MICRO_BATCH_SIZE) {
                        const jobPayload = {
                            jobDetails: { ...job, _id: job._id.toString(), projectId: job.projectId.toString() },
                            contacts: microBatch.map(c => ({...c, _id: c._id.toString()}))
                        };
                        await redis.lPush('broadcast-queue', JSON.stringify(jobPayload));
                        totalEnqueued += microBatch.length;
                        microBatch = [];
                    }
                }
                
                // Enqueue any remaining contacts
                if (microBatch.length > 0) {
                    const jobPayload = {
                        jobDetails: { ...job, _id: job._id.toString(), projectId: job.projectId.toString() },
                        contacts: microBatch.map(c => ({...c, _id: c._id.toString()}))
                    };
                    await redis.lPush('broadcast-queue', JSON.stringify(jobPayload));
                    totalEnqueued += microBatch.length;
                }
                
                // If no contacts were enqueued, it means the broadcast is done.
                if (totalEnqueued === 0 && job.contactCount > 0) {
                   await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'Completed', completedAt: new Date() } });
                }

            } finally {
                await db.collection('projects').updateOne({ _id: projectId }, { $set: { lock: false }, $unset: { lockTimestamp: '' } });
            }
        }
        
        return { message: `Enqueued ${totalEnqueued} contacts for ${jobsCreated} job(s).` };

    } catch (error: any) {
        console.error("Cron scheduler (Producer) failed:", error);
        throw new Error(`Cron scheduler failed: ${error.message}`);
    }
}
