
'use server';

/**
 * @fileOverview High-Throughput Broadcast Scheduler
 *
 * This file contains the core logic for processing and sending broadcast campaigns.
 * It is designed for high performance and scalability by fetching contacts directly
 * from the database and using a highly concurrent promise pool with a token bucket
 * rate-limiting algorithm.
 *
 * 1.  **Project-Based Locking:** A lock is acquired in the database for each project
 *     to ensure that only one scheduler process handles a specific project's
 *     broadcasts at a time, allowing for concurrent processing across different projects.
 *
 * 2.  **Database as a Queue:** Contacts are fetched directly from
 *     the `broadcast_contacts` collection in batches, avoiding complex in-memory queues.
 *
 * 3.  **Token Bucket Rate Limiting:** A sophisticated token bucket algorithm is used
 *     to control the rate of API requests to Meta, precisely respecting the
 *     project's configured `messagesPerSecond` limit. This allows for bursting and
 *     sustained high throughput.
 *
 * 4.  **Optimized Batched Database Writes:** Status updates for sent messages are
 *     buffered and flushed to MongoDB in batches to reduce DB load.
 */


import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';
import axios from 'axios';
import type { BroadcastJob as BroadcastJobType } from './definitions';

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

const API_VERSION = 'v23.0';
const DB_WRITE_BATCH_SIZE = 500;
const DB_READ_BATCH_SIZE = 2000;

// Token bucket implementation for rate limiting
const createTokenBucket = (rate: number, capacity: number) => {
    let tokens = capacity;
    let lastRefill = Date.now();

    return async () => {
        const now = Date.now();
        const elapsed = now - lastRefill;
        tokens = Math.min(capacity, tokens + (elapsed / 1000) * rate);
        lastRefill = now;

        if (tokens >= 1) {
            tokens -= 1;
            return 0; // No delay needed
        } else {
            const delay = (1 - tokens) * (1000 / rate);
            tokens = 0; // All tokens used, need to wait for refill
            return delay;
        }
    };
};

// Promise pool for managing concurrent async operations with rate limiting
async function promisePool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  rateLimiter: () => Promise<number>
) {
    const results: T[] = [];
    const executing = new Set<Promise<void>>();
    for (const task of tasks) {
        const delay = await rateLimiter();
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        const promise = task().then(result => {
            results.push(result);
            executing.delete(promise);
        });

        executing.add(promise);
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results;
}


async function sendWhatsAppMessage(
  db: Db,
  job: BroadcastJobType,
  contact: BroadcastContact,
): Promise<{ success: boolean; contactId: ObjectId; messageId?: string; error?: string }> {
    try {
        const {
            accessToken, phoneNumberId, templateName,
            language, components, headerImageUrl, headerMediaId
        } = job;
        
        const getVars = (text: string): number[] => {
            if (!text) return [];
            const variableMatches = text.match(/{{\s*(\d+)\s*}}/g);
            return variableMatches 
                ? [...new Set(variableMatches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] 
                : [];
        };

        const payloadComponents: any[] = [];
        const headerComponent = components.find(c => c.type === 'HEADER');
        if (headerComponent) {
            let parameter;
            const format = headerComponent.format?.toLowerCase();
            const contactVarForHeader = contact.variables?.[job.variableMappings?.find(m => m.var === 'header')?.value || ''] || headerComponent.example?.header_handle?.[0];

            if (headerMediaId) {
                parameter = { type: format, [format]: { id: headerMediaId } };
            } else if (headerImageUrl) {
                 parameter = { type: format, [format]: { link: headerImageUrl } };
            }
             if (parameter) {
                 payloadComponents.push({ type: 'header', parameters: [parameter] });
            }
        }

        const bodyComponent = components.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const bodyVars = getVars(bodyComponent.text);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => {
                    const mapping = job.variableMappings?.find(m => m.var === String(varNum));
                    const value = mapping ? contact.variables?.[mapping.value] : '';
                    return { type: 'text', text: value || '' };
                });
                payloadComponents.push({ type: 'body', parameters });
            }
        }
        
        const messageData = {
            messaging_product: 'whatsapp', to: contact.phone, recipient_type: 'individual', type: 'template',
            template: { name: templateName, language: { code: language || 'en_US' }, ...(payloadComponents.length > 0 && { components: payloadComponents }) },
        };
        
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
            messageData,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        const messageId = response.data?.messages?.[0]?.id;
        if (!messageId) {
            return { success: false, contactId: contact._id, error: "No message ID returned from Meta." };
        }

        return { success: true, contactId: contact._id, messageId };

    } catch (error: any) {
        const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
        return { success: false, contactId: contact._id, error: errorMessage };
    }
}

async function executeSingleBroadcast(db: Db, project: Project, job: BroadcastJobType) {
    const concurrency = job.messagesPerSecond || project.messagesPerSecond || 80;
    const rateLimiter = createTokenBucket(concurrency, concurrency);

    const contactCursor = db.collection<BroadcastContact>('broadcast_contacts').find({
        broadcastId: job._id,
        status: 'PENDING'
    });

    const updateOps: any[] = [];
    let successCount = 0;
    let errorCount = 0;
    
    const tasks = [];
    let hasMoreContacts = true;
    
    while(hasMoreContacts) {
        const contactBatch = await contactCursor.limit(DB_READ_BATCH_SIZE).toArray();
        if (contactBatch.length === 0) {
            hasMoreContacts = false;
            break;
        }

        for (const contact of contactBatch) {
            tasks.push(() => sendWhatsAppMessage(db, job, contact));
        }
        
        const results = await promisePool(tasks, concurrency, rateLimiter);
        
        for (const result of results) {
            if (result.success) {
                successCount++;
                updateOps.push({
                    updateOne: {
                        filter: { _id: result.contactId },
                        update: { $set: { status: 'SENT', sentAt: new Date(), messageId: result.messageId, error: null } }
                    }
                });
            } else {
                errorCount++;
                updateOps.push({
                    updateOne: {
                        filter: { _id: result.contactId },
                        update: { $set: { status: 'FAILED', error: result.error } }
                    }
                });
            }

            if (updateOps.length >= DB_WRITE_BATCH_SIZE) {
                await db.collection('broadcast_contacts').bulkWrite(updateOps, { ordered: false });
                updateOps.length = 0;
                await db.collection('broadcasts').updateOne({ _id: job._id }, { $inc: { successCount, errorCount } });
                successCount = 0; errorCount = 0;
            }
        }
        tasks.length = 0; // Clear tasks for the next batch
    }

    if (updateOps.length > 0) {
        await db.collection('broadcast_contacts').bulkWrite(updateOps, { ordered: false });
    }

    return { successCount, errorCount };
}


export async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;

        const projectsWithQueuedJobs = await db.collection('broadcasts').distinct('projectId', { status: 'QUEUED' });
        if (projectsWithQueuedJobs.length === 0) {
            return { message: 'No active broadcasts to process.' };
        }

        let totalSuccess = 0;
        let totalFailed = 0;
        let jobsProcessed = 0;

        for (const projectId of projectsWithQueuedJobs) {
            const lockAcquired = await db.collection('projects').findOneAndUpdate(
                { _id: projectId, lock: { $ne: true } },
                { $set: { lock: true, lockTimestamp: new Date() } }
            );

            if (!lockAcquired) {
                console.log(`Project ${projectId} is already being processed. Skipping.`);
                continue;
            }
            
            const project = lockAcquired as WithId<Project>;

            try {
                const job = await db.collection<BroadcastJobType>('broadcasts').findOne({
                    projectId: project._id,
                    status: 'QUEUED'
                }, { sort: { createdAt: 1 } });
                
                if (!job) {
                    await db.collection('projects').updateOne({ _id: project._id }, { $set: { lock: false }, $unset: { lockTimestamp: '' } });
                    continue;
                }

                await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'PROCESSING', startedAt: new Date() } });
                jobsProcessed++;

                const { successCount, errorCount } = await executeSingleBroadcast(db, project, job);
                totalSuccess += successCount;
                totalFailed += errorCount;

                const finalUpdate = {
                    status: errorCount > 0 ? 'PARTIAL_FAILURE' : 'COMPLETED',
                    completedAt: new Date(),
                    successCount: job.successCount ? job.successCount + successCount : successCount,
                    errorCount: job.errorCount ? job.errorCount + errorCount : errorCount,
                };
                await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: finalUpdate });

            } finally {
                await db.collection('projects').updateOne({ _id: project._id }, { $set: { lock: false }, $unset: { lockTimestamp: '' } });
            }
        }
        
        return {
            message: `Processed ${jobsProcessed} job(s). Total Sent: ${totalSuccess}, Total Failed: ${totalFailed}.`,
        };

    } catch (error: any) {
        console.error("Cron scheduler failed:", error);
        throw new Error(`Cron scheduler failed: ${error.message}`);
    }
}
