

'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId, FindOneAndUpdateOptions } from 'mongodb';
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
    attemptedCount?: number;
    successCount?: number;
    errorCount?: number;
    components: any[];
    language: string;
    headerImageUrl?: string;
    contactCount?: number;
    messagesPerSecond?: number;
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

const WRITE_INTERVAL_MS = 2000; // How often to write bulk updates to the DB.


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
 * An async generator that yields contacts at a specified rate and updates the attempted count.
 * @param db The database instance.
 * @param cursor The database cursor for contacts.
 * @param jobId The ID of the current broadcast job.
 * @param rate The number of contacts to yield per second.
 * @param checkCancelled A function to check if the job has been cancelled.
 */
async function* contactGenerator(
    db: Db, 
    cursor: any, 
    jobId: ObjectId, 
    rate: number,
    checkCancelled: () => Promise<boolean>
) {
    let localAttemptedCount = 0;
    const flushAttemptedCount = async () => {
        if (localAttemptedCount > 0) {
            await db.collection('broadcasts').updateOne({ _id: jobId }, { $inc: { attemptedCount: localAttemptedCount } });
            localAttemptedCount = 0;
        }
    };
    const flushInterval = setInterval(flushAttemptedCount, 2000); // Flush every 2s for faster UI updates

    try {
        while(await cursor.hasNext()) {
            if (await checkCancelled()) {
                break;
            }
            const intervalStartTime = Date.now();
            for (let i=0; i<rate; i++) {
                if (!(await cursor.hasNext())) break;
                const contact = await cursor.next();
                if (contact) {
                    yield contact;
                    localAttemptedCount++;
                }
            }
    
            const duration = Date.now() - intervalStartTime;
            const delay = 1000 - duration;
            if (delay > 0 && (await cursor.hasNext())) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    } finally {
        clearInterval(flushInterval);
        await flushAttemptedCount(); // Final flush
    }
}


export async function processBroadcastJob() {
    let db: Db;
    const processedJobsSummary: any[] = [];
    let totalSuccessCountAllJobs = 0;
    let totalErrorCountAllJobs = 0;
    let jobsProcessedCount = 0;

    try {
        const conn = await connectToDatabase();
        db = conn.db;

        for (let i = 0; i < 100; i++) {
            const preJob = await db.collection<BroadcastJob>('broadcasts').findOne({ status: 'QUEUED' }, { sort: { createdAt: 1 }});

            if (!preJob) {
                break; // No more queued jobs
            }
            
            const project = await db.collection<Project>('projects').findOne(
                { _id: preJob.projectId },
                { projection: { messagesPerSecond: 1 } }
            );

            // Use the project's configured rate, or default to 80 messages/sec
            const MESSAGES_PER_SECOND = project?.messagesPerSecond || 80;

            const findOneAndUpdateOptions: FindOneAndUpdateOptions = {
                returnDocument: 'after'
            };

            const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
                { _id: preJob._id, status: 'QUEUED' },
                {
                    $set: {
                        status: 'PROCESSING',
                        startedAt: new Date(),
                        attemptedCount: 0,
                        successCount: 0,
                        errorCount: 0,
                        messagesPerSecond: MESSAGES_PER_SECOND,
                    }
                },
                findOneAndUpdateOptions
            );

            if (!job) {
                // Another worker picked up the job, try the next one.
                continue;
            }
            
            jobsProcessedCount++;
            const jobId = job._id;

            try {
                const CONCURRENCY_LIMIT = 500; 

                const uploadFilename = job.headerImageUrl?.split('/').pop()?.split('?')[0] || 'media-file';

                const operationsBuffer: any[] = [];
                
                const sendSingleMessage = async (contactDoc: BroadcastContact) => {
                    const contact = { phone: contactDoc.phone, ...contactDoc.variables };
                    const phone = contact.phone;
                    
                    try {
                        const getVars = (text: string): number[] => {
                            if (!text) return [];
                            const variableMatches = text.match(/{{(\d+)}}/g);
                            return variableMatches ? [...new Set(variableMatches.map(v => parseInt(v.match(/(\d+)/)![1])))] : [];
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
                                const type = headerComponent.format.toLowerCase();
                                const mediaObject: any = { link: job.headerImageUrl };
                                if (type === 'document') mediaObject.filename = contact['filename'] || uploadFilename;
                                parameters.push({ type, [type]: mediaObject });
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

                const cursor = db.collection<BroadcastContact>('broadcast_contacts').find({ broadcastId: jobId, status: 'PENDING' });
                
                let isCancelled = false;
                const checkCancelled = async (): Promise<boolean> => {
                    if (isCancelled) return true;
                    const currentJobState = await db.collection<BroadcastJob>('broadcasts').findOne({_id: jobId}, {projection: {status: 1}});
                    if (currentJobState?.status === 'Cancelled') {
                        isCancelled = true;
                        return true;
                    }
                    return false;
                };

                try {
                    const generator = contactGenerator(db, cursor, jobId, MESSAGES_PER_SECOND, checkCancelled);

                    await promisePool(CONCURRENCY_LIMIT, generator, async (contact) => {
                        const operation = await sendSingleMessage(contact);
                        if (operation) {
                            operationsBuffer.push(operation);
                        }
                    });
                } finally {
                    await cursor.close();
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

                processedJobsSummary.push({ jobId: jobId.toString(), status: finalStatus, success: jobSuccessCount, failed: jobErrorCount });
                totalSuccessCountAllJobs += jobSuccessCount;
                totalErrorCountAllJobs += jobErrorCount;

            } catch (processingError: any) {
                 const errorMsg = getAxiosErrorMessage(processingError);
                 console.error(`Processing failed for job ${jobId}: ${errorMsg}`);
                 const finalJobState = await db.collection('broadcasts').findOne({_id: jobId});
                 const finalStatus = (finalJobState?.successCount || 0) > 0 ? 'Partial Failure' : 'Failed';
                 await db.collection('broadcasts').updateOne(
                    { _id: jobId },
                    { $set: { status: finalStatus, completedAt: new Date() } }
                 );
                processedJobsSummary.push({ jobId: jobId.toString(), status: `Processing Error - ${finalStatus}`, error: errorMsg });
            }
        }

        if (jobsProcessedCount === 0) {
            return { message: 'No queued broadcasts to process.' };
        }

        return {
            message: `Processed ${jobsProcessedCount} broadcast job(s).`,
            totalSuccess: totalSuccessCountAllJobs,
            totalFailed: totalErrorCountAllJobs,
            jobs: processedJobsSummary,
        };

    } catch (error: any) {
        console.error("Cron scheduler failed:", getAxiosErrorMessage(error));
        throw new Error(`Cron scheduler failed: ${getAxiosErrorMessage(error)}`);
    }
}
