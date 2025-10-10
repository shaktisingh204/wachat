
'use server';

/**
 * @fileOverview High-Throughput Broadcast Scheduler
 *
 * This file contains the cron job logic that acts as a "producer".
 * Its primary responsibility is to:
 * 1. Find projects with broadcasts in the 'QUEUED' state.
 * 2. Acquire a lock on a project to ensure it's processed by only one instance.
 * 3. Fetch all 'PENDING' contacts for the active broadcast job.
 * 4. Enqueue each contact as a separate message task into a Redis list.
 * 5. Mark the broadcast job as 'PROCESSING'.
 *
 * The actual sending of messages is handled by the worker processes defined in `server.js`,
 * which act as "consumers" for the Redis queue.
 */

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redis';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType } from './definitions';

export async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;

        const projectsWithQueuedJobs = await db.collection('broadcasts').distinct('projectId', { status: 'QUEUED' });
        if (projectsWithQueuedJobs.length === 0) {
            return { message: 'No active broadcasts to process.' };
        }

        let totalEnqueued = 0;
        let jobsStarted = 0;

        for (const projectId of projectsWithQueuedJobs) {
            const lockAcquired = await db.collection('projects').findOneAndUpdate(
                { _id: projectId, lock: { $ne: true } },
                { $set: { lock: true, lockTimestamp: new Date() } }
            );

            if (!lockAcquired) {
                console.log(`Project ${projectId} is already being processed. Skipping.`);
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
                jobsStarted++;
                
                const redis = await getRedisClient();
                const contactCursor = db.collection('broadcast_contacts').find({
                    broadcastId: job._id,
                    status: 'PENDING'
                });

                let enqueuedInJob = 0;
                while (await contactCursor.hasNext()) {
                    const contact = await contactCursor.next();
                    if (contact) {
                        const task = JSON.stringify({
                            jobId: job._id.toString(),
                            contactId: contact._id.toString(),
                            projectId: job.projectId.toString(),
                        });
                        await redis.lPush('broadcast_queue', task);
                        enqueuedInJob++;
                    }
                }
                
                console.log(`Enqueued ${enqueuedInJob} contacts for job ${job._id}`);
                totalEnqueued += enqueuedInJob;

            } finally {
                await db.collection('projects').updateOne({ _id: projectId }, { $set: { lock: false }, $unset: { lockTimestamp: '' } });
            }
        }
        
        return {
            message: `Started ${jobsStarted} job(s). Total contacts enqueued: ${totalEnqueued}.`,
        };

    } catch (error: any) {
        console.error("Cron scheduler failed:", error);
        throw new Error(`Cron scheduler failed: ${error.message}`);
    }
}
