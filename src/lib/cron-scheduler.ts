
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';
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
 * Runs an async iterator function over an array of items with a specified concurrency limit.
 * @param poolLimit The maximum number of promises to run in parallel.
 * @param iterable The array of items to iterate over.
 * @param iteratorFn The async function to apply to each item.
 */
async function promisePool<T>(
  poolLimit: number,
  iterable: T[],
  iteratorFn: (item: T) => Promise<any>
): Promise<void> {
  const executing = new Set<Promise<any>>();
  for (const item of iterable) {
    const p = iteratorFn(item);
    executing.add(p);
    // When the promise is done, remove it from the set
    p.then(() => executing.delete(p));
    // If the pool is full, wait for one promise to complete
    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }
  // Wait for all remaining promises to complete
  await Promise.all(Array.from(executing));
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
            const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
                { status: 'QUEUED' },
                {
                    $set: {
                        status: 'PROCESSING',
                        startedAt: new Date(),
                        successCount: 0,
                        errorCount: 0,
                    }
                },
                { returnDocument: 'after', sort: { createdAt: 1 } }
            );

            if (!job) {
                break; // No more queued jobs
            }
            
            jobsProcessedCount++;
            const jobId = job._id;

            try {
                const project = await db.collection<Project>('projects').findOne({ _id: job.projectId });
                const MESSAGES_PER_SECOND = project?.messagesPerSecond || 80;
                // Set a robust concurrency limit, maxing out at 50 parallel requests
                const CONCURRENCY_LIMIT = Math.min(MESSAGES_PER_SECOND, 50); 
                const WRITE_INTERVAL_MS = 10000;

                const uploadFilename = job.headerImageUrl?.split('/').pop()?.split('?')[0] || 'media-file';

                const operationsBuffer: any[] = [];
                let hasMoreContacts = true;

                // Set up a periodic writer to flush the buffer to the DB every 10 seconds
                const writeInterval = setInterval(async () => {
                    if (operationsBuffer.length > 0) {
                        const bufferCopy = [...operationsBuffer];
                        operationsBuffer.length = 0; // Clear the buffer immediately
                        
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

                const sendSingleMessage = async (contactDoc: BroadcastContact) => {
                    // This function sends one message and returns the DB operation object
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

                while (hasMoreContacts) {
                    const currentJobState = await db.collection<BroadcastJob>('broadcasts').findOne({_id: jobId}, {projection: {status: 1}});
                    if (currentJobState?.status === 'Cancelled') {
                        hasMoreContacts = false;
                        break;
                    }
                    
                    const contactsForInterval = await db.collection<BroadcastContact>('broadcast_contacts').find({
                        broadcastId: jobId,
                        status: 'PENDING'
                    }).limit(MESSAGES_PER_SECOND).toArray();

                    if (contactsForInterval.length === 0) {
                        hasMoreContacts = false;
                        continue;
                    }

                    const intervalStartTime = Date.now();
                    
                    // Use the promise pool to process all contacts for this second with high concurrency
                    await promisePool(CONCURRENCY_LIMIT, contactsForInterval, async (contact) => {
                        const operation = await sendSingleMessage(contact);
                        operationsBuffer.push(operation);
                    });

                    const duration = Date.now() - intervalStartTime;
                    const delay = 1000 - duration;

                    if (hasMoreContacts && delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                
                // Cleanup: Stop the periodic writer and do one final flush
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

                // Finalize job status
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

    