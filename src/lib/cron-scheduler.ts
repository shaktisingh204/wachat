
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

const WRITE_INTERVAL_MS = 2000;
const BATCH_WRITE_SIZE = 1000;

const getAxiosErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error)) {
        if (error.response) {
            const apiError = error.response.data?.error;
            if (apiError) {
                return `${apiError.error_user_title ? `${apiError.error_user_title}: ${apiError.error_user_msg}` : apiError.message || 'API Error'} (Code: ${apiError.code}, Type: ${apiError.type})`;
            }
            return `Request failed with status code ${error.response.status}`;
        } else if (error.request) {
            return 'No response received from server. Check network connectivity.';
        } else {
            return error.message;
        }
    }
    return error.message || 'An unknown error occurred';
};


async function promisePool<T>(
  poolLimit: number,
  iterable: AsyncGenerator<T>,
  iteratorFn: (item: T) => Promise<any>
): Promise<void> {
  const executing = new Set<Promise<any>>();
  for await (const item of iterable) {
    const p = iteratorFn(item).finally(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(Array.from(executing));
}

/**
 * An async generator that yields contacts directly from the database.
 */
async function* contactGenerator(
    db: Db,
    broadcastId: ObjectId,
    checkCancelled: () => Promise<boolean>,
    chunkSize: number = 100
) {
    let lastId: ObjectId | undefined = undefined;
    while (true) {
        if (await checkCancelled()) {
            console.log(`Cancellation detected for broadcast ${broadcastId}. Stopping generator.`);
            break;
        }

        const query: any = { broadcastId, status: 'PENDING' };
        if (lastId) {
            query._id = { $gt: lastId };
        }

        const contacts = await db.collection('broadcast_contacts')
            .find(query)
            .sort({ _id: 1 })
            .limit(chunkSize)
            .toArray();

        if (contacts.length === 0) {
            break;
        }

        for (const contact of contacts) {
            yield contact;
        }
        
        lastId = contacts[contacts.length - 1]._id;
    }
}


async function executeSingleBroadcast(db: Db, job: BroadcastJobType, perJobRate: number): Promise<any> {
    const jobId = job._id;
    const operationsBuffer: any[] = [];
    
    const flushBuffer = async () => {
        if (operationsBuffer.length === 0) return;
        
        const bufferCopy = [...operationsBuffer];
        operationsBuffer.length = 0;

        await db.collection('broadcast_contacts').bulkWrite(bufferCopy, { ordered: false });
            
        const successCount = bufferCopy.filter(op => op.updateOne.update.$set.status === 'SENT').length;
        const errorCount = bufferCopy.length - successCount;

        if (successCount > 0 || errorCount > 0) {
            await db.collection('broadcasts').updateOne({ _id: jobId }, {
                $inc: { successCount, errorCount },
            });
        }
    };
    
    const sendSingleMessage = async (db: Db, job: BroadcastJobType, contactDoc: BroadcastContact) => {
        const contact = { phone: contactDoc.phone, ...contactDoc.variables };
        const phone = contact.phone;

        if (job.category !== 'AUTHENTICATION') {
            const isOptedOut = await db.collection('contacts').findOne(
                { projectId: job.projectId, waId: phone, isOptedOut: true },
                { projection: { _id: 1 } }
            );

            if (isOptedOut) {
                return {
                    updateOne: {
                        filter: { _id: contactDoc._id },
                        update: { $set: { status: 'FAILED', error: 'Contact opted out' } }
                    }
                };
            }
        }
        
        try {
            const getVars = (text: string): number[] => {
                if (!text) return [];
                const variableMatches = text.match(/{{\s*(\d+)\s*}}/g);
                return variableMatches 
                    ? [...new Set(variableMatches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] 
                    : [];
            };

            const payloadComponents: any[] = [];
            const headerComponent = job.components.find(c => c.type === 'HEADER');
            if (headerComponent) {
                const parameters: any[] = [];
                if (headerComponent.format === 'TEXT' && headerComponent.text) {
                    const headerVars = getVars(headerComponent.text);
                    if (headerVars.length > 0) {
                        headerVars.sort((a,b) => a-b).forEach(varNum => {
                            parameters.push({ type: 'text', text: contact[`variable${varNum}`] || '' });
                        });
                    }
                     if (parameters.length > 0) payloadComponents.push({ type: 'header', parameters });
                } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerComponent.format)) {
                    const format = headerComponent.format.toLowerCase();
                    let parameter: any;
                    if (job.headerMediaId) {
                        parameter = { type: format, [format]: { id: job.headerMediaId } };
                    } else if (job.headerImageUrl) {
                        parameter = { type: format, [format]: { link: job.headerImageUrl } };
                        if(format === 'document') {
                            parameter.document.filename = contact['filename'] || 'document';
                        }
                    }
                    if (parameter) {
                        // Media parameters are not nested inside a 'parameters' array
                        payloadComponents.push({ type: 'header', parameters: [parameter] });
                    }
                }
            }

            const bodyComponent = job.components.find(c => c.type === 'BODY');
            if (bodyComponent?.text) {
                const bodyVars = getVars(bodyComponent.text);
                if (bodyVars.length > 0) {
                    const parameters = bodyVars.sort((a,b) => a-b).map(varNum => ({ type: 'text', text: contact[`variable${varNum}`] || '' }));
                    payloadComponents.push({ type: 'body', parameters });
                }
            }

            const buttonsComponent = job.components.find(c => c.type === 'BUTTONS');
            if (buttonsComponent && Array.isArray(buttonsComponent.buttons)) {
                    buttonsComponent.buttons.forEach((button: any, index: number) => {
                    if (button.type === 'URL' && button.url?.includes('{{1}}') && contact[`button_url_param_${index}`]) {
                        payloadComponents.push({
                            type: 'button',
                            sub_type: 'url',
                            index: String(index),
                            parameters: [{ type: 'text', text: contact[`button_url_param_${index}`] }]
                        });
                    }
                });
            }
            
            const messageData = {
                messaging_product: 'whatsapp', to: phone, recipient_type: 'individual', type: 'template',
                template: { name: job.templateName, language: { code: job.language || 'en_US' }, ...(payloadComponents.length > 0 && { components: payloadComponents }) },
            };
            
            const response = await axios.post(
                `https://graph.facebook.com/v22.0/${job.phoneNumberId}/messages`,
                messageData,
                { headers: { 'Authorization': `Bearer ${job.accessToken}` } }
            );

            return {
                updateOne: {
                    filter: { _id: contactDoc._id },
                    update: { $set: { status: 'SENT', sentAt: new Date(), messageId: response.data?.messages?.[0]?.id } }
                }
            };
        } catch(error: any) {
            const errorMessage = getAxiosErrorMessage(error);
            return {
                updateOne: {
                    filter: { _id: contactDoc._id },
                    update: { $set: { status: 'FAILED', sentAt: new Date(), error: errorMessage } }
                }
            };
        }
    };

    const writeInterval = setInterval(flushBuffer, WRITE_INTERVAL_MS);
    
    try {
        let isCancelled = false;
        let lastCheckTime = 0;
        const checkCancelled = async (): Promise<boolean> => {
            if (isCancelled) return true;
            
            const now = Date.now();
            if (now - lastCheckTime > 2000) { 
                lastCheckTime = now;
                const currentJobState = await db.collection<BroadcastJobType>('broadcasts').findOne({_id: jobId}, {projection: {status: 1}});
                if (currentJobState?.status === 'Cancelled') {
                    isCancelled = true;
                    return true;
                }
            }
            return false;
        };

        const generator = contactGenerator(db, jobId, checkCancelled, perJobRate);
        await promisePool(perJobRate, generator, async (contact) => {
            if (!contact) return;
            const operation = await sendSingleMessage(db, job, contact);
            if (operation) {
                operationsBuffer.push(operation);
                if (operationsBuffer.length >= BATCH_WRITE_SIZE) {
                    await flushBuffer();
                }
            }
        });
    } catch (processingError: any) {
        const errorMsg = getAxiosErrorMessage(processingError);
        console.error(`Processing failed for job ${jobId}: ${errorMsg}`);
        const finalJobState = await db.collection('broadcasts').findOne({_id: jobId});
        const finalStatus = (finalJobState?.successCount || 0) > 0 ? 'Partial Failure' : 'Failed';
        await db.collection('broadcasts').updateOne(
            { _id: jobId },
            { $set: { status: finalStatus, completedAt: new Date(), error: errorMsg } }
        );
        return { jobId: jobId.toString(), status: `Processing Error - ${finalStatus}`, error: errorMsg };
    } finally {
        clearInterval(writeInterval);
        
        // Final flush for any remaining operations in the buffer
        await flushBuffer();

        const finalJobState = await db.collection('broadcasts').findOne({_id: jobId});
        const jobSuccessCount = finalJobState?.successCount || 0;
        const jobErrorCount = finalJobState?.errorCount || 0;
        const jobStatus = finalJobState?.status;

        let finalStatus: 'Completed' | 'Partial Failure' | 'Failed' | 'Cancelled' = 'Completed';
        if (jobStatus === 'Cancelled') {
            finalStatus = 'Cancelled';
        } else if (jobErrorCount > 0) {
            finalStatus = (jobSuccessCount > 0) ? 'Partial Failure' : 'Failed';
        }

        await db.collection('broadcasts').updateOne(
            { _id: jobId },
            { $set: { status: finalStatus, completedAt: new Date() } }
        );
    }
    
    const finalJob = await db.collection('broadcasts').findOne({ _id: jobId });
    return { jobId: jobId.toString(), status: finalJob?.status, success: finalJob?.successCount, failed: finalJob?.errorCount };
}


export async function processBroadcastJob() {
    let db: Db;
    
    try {
        const conn = await connectToDatabase();
        db = conn.db;

        // 1. Find all distinct projects with queued broadcasts.
        const projectIdsWithQueuedJobs = await db.collection('broadcasts').distinct('projectId', { status: 'QUEUED' });
        
        if (projectIdsWithQueuedJobs.length === 0) {
            return { message: 'No active broadcasts to process.' };
        }
        
        const allProcessingTasks: Promise<any>[] = [];

        // 2. Iterate through each project and attempt to process its jobs.
        for (const projectId of projectIdsWithQueuedJobs) {
            const lockId = `SCHEDULER_LOCK_${projectId.toString()}`;
            let lockAcquired = false;

            try {
                const now = new Date();
                const lockHeldUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 minute lock
                
                const lockResult = await db.collection('locks').findOneAndUpdate(
                    { _id: lockId, $or: [{ lockHeldUntil: { $lt: now } }, { lockHeldUntil: { $exists: false } }] },
                    { $set: { lockHeldUntil: lockHeldUntil } },
                    { upsert: true, returnDocument: 'after' }
                );

                if (!lockResult) {
                    console.log(`Skipping project ${projectId}: lock held by another process.`);
                    continue; // Lock is held, move to the next project
                }
                lockAcquired = true;
                
                // 3. If lock is acquired, fetch and process jobs for THIS project.
                const jobsForThisProject = await db.collection<BroadcastJobType>('broadcasts').find({
                    projectId: projectId,
                    status: 'QUEUED'
                }).sort({ createdAt: 1 }).toArray();

                if (jobsForThisProject.length === 0) {
                    continue; // No jobs for this project, move to next.
                }

                const jobIdsToUpdate = jobsForThisProject.map(j => j._id);
                await db.collection('broadcasts').updateMany(
                    { _id: { $in: jobIdsToUpdate } },
                    { $set: { status: 'PROCESSING', startedAt: new Date(), successCount: 0, errorCount: 0 } }
                );

                const project = await db.collection<Project>('projects').findOne(
                    { _id: projectId },
                    { projection: { messagesPerSecond: 1 } }
                );

                const totalRateForProject = project?.messagesPerSecond || 80;
                const perJobRate = Math.max(1, Math.floor(totalRateForProject / jobsForThisProject.length));

                for (const job of jobsForThisProject) {
                    await db.collection('broadcasts').updateOne(
                        { _id: job._id }, 
                        { $set: { messagesPerSecond: perJobRate, projectMessagesPerSecond: totalRateForProject }}
                    );
                    const updatedJob = { ...job, messagesPerSecond: perJobRate, projectMessagesPerSecond: totalRateForProject };
                    allProcessingTasks.push(executeSingleBroadcast(db, updatedJob, perJobRate));
                }

            } finally {
                if (lockAcquired) {
                    await db.collection('locks').updateOne(
                        { _id: lockId },
                        { $set: { lockHeldUntil: new Date(0) } }
                    );
                }
            }
        }
        
        const results = await Promise.all(allProcessingTasks);
        
        const totalSuccessCount = results.reduce((sum, r) => sum + (r.success || 0), 0);
        const totalFailedCount = results.reduce((sum, r) => sum + (r.failed || 0), 0);
        
        return {
            message: `Processed ${results.length} broadcast job(s) across ${projectIdsWithQueuedJobs.length} project(s).`,
            totalSuccess: totalSuccessCount,
            totalFailed: totalFailedCount,
            jobs: results,
        };

    } catch (error: any) {
        console.error("Cron scheduler failed:", getAxiosErrorMessage(error));
        throw new Error(`Cron scheduler failed: ${getAxiosErrorMessage(error)}`);
    }
}

  

    
