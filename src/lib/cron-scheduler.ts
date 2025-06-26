

'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId, FindOneAndUpdateOptions, Filter } from 'mongodb';
import axios from 'axios';

type BroadcastJob = {
    _id: ObjectId;
    projectId: ObjectId;
    templateId: ObjectId;
    templateName: string;
    phoneNumberId: string;
    accessToken: string;
    status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Partial Failure' | 'Failed' | 'Cancelled';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    successCount?: number;
    errorCount?: number;
    components: any[];
    language: string;
    headerImageUrl?: string;
    contactCount?: number;
    messagesPerSecond?: number;
    projectMessagesPerSecond?: number;
};

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

const WRITE_INTERVAL_MS = 1000; // How often to write bulk updates to the DB.


const getAxiosErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error)) {
        if (error.response) {
            const apiError = error.response.data?.error;
            if (apiError) {
                return `${apiError.message || 'API Error'} (Code: ${apiError.code}, Type: ${apiError.type})`;
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

/**
 * Runs an async iterator function over an async generator of items with a specified concurrency limit.
 * @param poolLimit The maximum number of promises to run in parallel.
 * @param iterable An async generator that yields items to process.
 * @param iteratorFn The async function to apply to each item.
 */
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
 * An async generator that yields contacts from the database for a given job.
 * This is a simple cursor over the pending contacts. The rate of sending is controlled
 * by the consumer (the promisePool).
 * @param db The database instance.
 * @param jobId The ID of the current broadcast job.
 * @param checkCancelled A function to check if the job has been cancelled.
 */
async function* contactGenerator(
    db: Db,
    jobId: ObjectId,
    checkCancelled: () => Promise<boolean>
) {
    const cursor = db.collection<BroadcastContact>('broadcast_contacts')
        .find({ broadcastId: jobId, status: 'PENDING' })
        .sort({ _id: 1 });

    try {
        for await (const contact of cursor) {
            if (await checkCancelled()) {
                break; // Stop yielding if job is cancelled
            }
            yield contact;
        }
    } finally {
        await cursor.close(); // Ensure cursor is closed
    }
}


async function executeSingleBroadcast(db: Db, job: BroadcastJob, perJobRate: number): Promise<any> {
    const jobId = job._id;
    try {
        const uploadFilename = 'media-file';

        const operationsBuffer: any[] = [];
        
        const sendSingleMessage = async (contactDoc: BroadcastContact) => {
            const contact = { phone: contactDoc.phone, ...contactDoc.variables };
            const phone = contact.phone;
            
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
                    } else if (job.headerImageUrl && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerComponent.format)) {
                        const format = headerComponent.format.toUpperCase();
                        const link = job.headerImageUrl;
                        let parameter;

                        switch (format) {
                            case 'IMAGE':
                                parameter = { type: 'image', image: { link } };
                                break;
                            case 'VIDEO':
                                parameter = { type: 'video', video: { link } };
                                break;
                            case 'DOCUMENT':
                                parameter = { type: 'document', document: { link, filename: contact['filename'] || uploadFilename } };
                                break;
                            case 'AUDIO':
                                parameter = { type: 'audio', audio: { link } };
                                break;
                        }

                        if (parameter) {
                            parameters.push(parameter);
                        }
                    }
                    if (parameters.length > 0) payloadComponents.push({ type: 'header', parameters });
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

        const writeInterval = setInterval(async () => {
            if (operationsBuffer.length > 0) {
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
            }
        }, WRITE_INTERVAL_MS);
        
        let isCancelled = false;
        let lastCheckTime = 0;
        const checkCancelled = async (): Promise<boolean> => {
            if (isCancelled) return true;
            
            const now = Date.now();
            if (now - lastCheckTime > 2000) { // Check every 2 seconds
                lastCheckTime = now;
                const currentJobState = await db.collection<BroadcastJob>('broadcasts').findOne({_id: jobId}, {projection: {status: 1}});
                if (currentJobState?.status === 'Cancelled') {
                    isCancelled = true;
                    return true;
                }
            }
            return false;
        };

        try {
            const generator = contactGenerator(db, jobId, checkCancelled);

            await promisePool(perJobRate, generator, async (contact) => {
                const operation = await sendSingleMessage(contact);
                if (operation) {
                    operationsBuffer.push(operation);
                }
            });
        } finally {
            // Cleanup is handled in the generator's finally block
        }

        clearInterval(writeInterval);

        if (operationsBuffer.length > 0) {
             const bufferCopy = [...operationsBuffer];
             await db.collection('broadcast_contacts').bulkWrite(bufferCopy, { ordered: false });
                
             const successCount = bufferCopy.filter(op => op.updateOne.update.$set.status === 'SENT').length;
             const errorCount = bufferCopy.length - successCount;

             if (successCount > 0 || errorCount > 0) {
                await db.collection('broadcasts').updateOne({ _id: jobId }, {
                    $inc: { successCount, errorCount },
                });
             }
        }

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

        return { jobId: jobId.toString(), status: finalStatus, success: jobSuccessCount, failed: jobErrorCount };

    } catch (processingError: any) {
         const errorMsg = getAxiosErrorMessage(processingError);
         console.error(`Processing failed for job ${jobId}: ${errorMsg}`);
         const finalJobState = await db.collection('broadcasts').findOne({_id: jobId});
         const finalStatus = (finalJobState?.successCount || 0) > 0 ? 'Partial Failure' : 'Failed';
         await db.collection('broadcasts').updateOne(
            { _id: jobId },
            { $set: { status: finalStatus, completedAt: new Date() } }
         );
        return { jobId: jobId.toString(), status: `Processing Error - ${finalStatus}`, error: errorMsg };
    }
}


export async function processBroadcastJob() {
    const lockId = 'SCHEDULER_LOCK';
    let db: Db;
    let lockAcquired = false;

    try {
        const conn = await connectToDatabase();
        db = conn.db;

        // --- Acquire Lock ---
        const now = new Date();
        const lockHeldUntil = new Date(now.getTime() + 5 * 60 * 1000); // Lock for 5 minutes

        let lockResult;
        try {
            lockResult = await db.collection('broadcasts').findOneAndUpdate(
                { 
                    _id: lockId,
                    $or: [
                        { lockHeldUntil: { $exists: false } },
                        { lockHeldUntil: { $lt: now } }
                    ]
                },
                { $set: { lockHeldUntil } },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (e: any) {
            if (e.code === 11000) { // Duplicate key error from a race condition
                lockResult = null; // We lost the race, so we don't have the lock
            } else {
                throw e; // Re-throw other unexpected errors
            }
        }
        
        if (!lockResult) {
             console.log("Scheduler lock held by another process. Exiting.");
             return { message: "Scheduler lock held by another process." };
        }
        lockAcquired = true;
        // --- End Acquire Lock ---

        const tenSecondsAgo = new Date(Date.now() - 10 * 1000);

        const jobsForThisRun = await db.collection<BroadcastJob>('broadcasts').find({
            _id: { $ne: lockId },
            $or: [
                { status: 'QUEUED' },
                { status: 'PROCESSING', startedAt: { $lt: tenSecondsAgo } }
            ]
        }).sort({ createdAt: 1 }).toArray();


        if (jobsForThisRun.length === 0) {
            return { message: 'No active broadcasts to process.' };
        }
        
        const jobIdsToUpdate = jobsForThisRun.map(j => j._id);
        await db.collection('broadcasts').updateMany(
            { _id: { $in: jobIdsToUpdate } },
            {
                $set: {
                    status: 'PROCESSING',
                    startedAt: new Date(),
                    successCount: 0,
                    errorCount: 0,
                }
            }
        );

        const jobsByProject = jobsForThisRun.reduce((acc, job) => {
            const projectId = job.projectId.toString();
            if (!acc[projectId]) {
                acc[projectId] = [];
            }
            acc[projectId].push(job);
            return acc;
        }, {} as Record<string, BroadcastJob[]>);

        const processingTasks: Promise<any>[] = [];

        for (const projectIdStr in jobsByProject) {
            const jobsInProject = jobsByProject[projectIdStr];
            const project = await db.collection<Project>('projects').findOne(
                { _id: new ObjectId(projectIdStr) },
                { projection: { messagesPerSecond: 1 } }
            );

            const totalRateForProject = project?.messagesPerSecond || 1000;
            const perJobRate = Math.max(1, Math.floor(totalRateForProject / jobsInProject.length));

            for (const job of jobsInProject) {
                await db.collection('broadcasts').updateOne(
                    { _id: job._id }, 
                    { $set: { messagesPerSecond: perJobRate, projectMessagesPerSecond: totalRateForProject }}
                );
                const updatedJob = { ...job, messagesPerSecond: perJobRate, projectMessagesPerSecond: totalRateForProject };
                processingTasks.push(executeSingleBroadcast(db, updatedJob, perJobRate));
            }
        }
        
        const results = await Promise.all(processingTasks);
        
        const totalSuccessCount = results.reduce((sum, r) => sum + (r.success || 0), 0);
        const totalFailedCount = results.reduce((sum, r) => sum + (r.failed || 0), 0);
        
        return {
            message: `Processed ${results.length} broadcast job(s).`,
            totalSuccess: totalSuccessCount,
            totalFailed: totalFailedCount,
            jobs: results,
        };

    } catch (error: any) {
        console.error("Cron scheduler failed:", getAxiosErrorMessage(error));
        throw new Error(`Cron scheduler failed: ${getAxiosErrorMessage(error)}`);
    } finally {
        if (lockAcquired) {
            try {
                const conn = await connectToDatabase();
                db = conn.db;
                await db.collection('broadcasts').updateOne(
                    { _id: lockId },
                    { $set: { lockHeldUntil: new Date(0) } } // Release lock
                );
            } catch(e) {
                console.error("Failed to release scheduler lock:", e);
            }
        }
    }
}
