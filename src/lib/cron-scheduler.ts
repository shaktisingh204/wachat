
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
                break;
            }
            
            jobsProcessedCount++;
            const jobId = job._id;

            try {
                const project = await db.collection<Project>('projects').findOne({ _id: job.projectId });
                const MESSAGES_PER_SECOND = project?.messagesPerSecond || 80;
                const CONCURRENCY_LIMIT = 10; 
                const WRITE_INTERVAL_MS = 10000; // Write to DB every 10 seconds

                const uploadFilename = job.headerImageUrl?.split('/').pop()?.split('?')[0] || 'media-file';

                let hasMoreContacts = true;
                while (hasMoreContacts) {
                    const contactsForInterval = await db.collection<BroadcastContact>('broadcast_contacts').find({
                        broadcastId: jobId,
                        status: 'PENDING'
                    }).limit(MESSAGES_PER_SECOND).toArray();

                    if (contactsForInterval.length === 0) {
                        hasMoreContacts = false;
                        continue;
                    }

                    const intervalStartTime = Date.now();
                    let lastWriteTime = intervalStartTime;
                    
                    let successThisInterval = 0;
                    let errorsThisInterval = 0;
                    const operationsBuffer: any[] = [];

                    for (let j = 0; j < contactsForInterval.length; j += CONCURRENCY_LIMIT) {
                        const chunk = contactsForInterval.slice(j, j + CONCURRENCY_LIMIT);
                        
                        const sendPromises = chunk.map(async (contactDoc) => {
                            const contact = { phone: contactDoc.phone, ...contactDoc.variables };
                            const phone = contact.phone;
                            let messageData: any = {};

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
                                    } else if (job.headerImageUrl) {
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
                                if (buttonsComponent && Array.isArray(buttonsComponent.button)) {
                                     buttonsComponent.button.forEach((button: any, index: number) => {
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
                                
                                messageData = {
                                    messaging_product: 'whatsapp', to: phone, recipient_type: 'individual', type: 'template',
                                    template: { name: job.templateName, language: { code: job.language || 'en_US' }, ...(payloadComponents.length > 0 && { components: payloadComponents }) },
                                };
                                
                                const response = await axios.post(
                                    `https://graph.facebook.com/v22.0/${job.phoneNumberId}/messages`,
                                    messageData,
                                    { headers: { 'Authorization': `Bearer ${job.accessToken}` } }
                                );

                                return {
                                    success: true,
                                    operation: {
                                        updateOne: {
                                            filter: { _id: contactDoc._id },
                                            update: { $set: { status: 'SENT', sentAt: new Date(), messageId: response.data?.messages?.[0]?.id } }
                                        }
                                    }
                                };
                            } catch(error: any) {
                                const errorMessage = getAxiosErrorMessage(error);
                                return {
                                    success: false,
                                    operation: {
                                        updateOne: {
                                            filter: { _id: contactDoc._id },
                                            update: { $set: { status: 'FAILED', sentAt: new Date(), error: errorMessage } }
                                        }
                                    }
                                };
                            }
                        });

                        const results = await Promise.all(sendPromises);
                        
                        const operations = results.map(r => r.operation).filter(op => op);
                        if (operations.length > 0) {
                            operationsBuffer.push(...operations);
                        }

                        successThisInterval += results.filter(r => r.success).length;
                        errorsThisInterval += results.filter(r => !r.success).length;

                        const now = Date.now();
                        if (operationsBuffer.length > 0 && (now - lastWriteTime >= WRITE_INTERVAL_MS)) {
                            await db.collection('broadcast_contacts').bulkWrite(operationsBuffer, { ordered: false });
                            operationsBuffer.length = 0;
                            lastWriteTime = now;
                        }
                    }

                    if (operationsBuffer.length > 0) {
                        await db.collection('broadcast_contacts').bulkWrite(operationsBuffer, { ordered: false });
                        operationsBuffer.length = 0;
                    }

                    if (successThisInterval > 0 || errorsThisInterval > 0) {
                        await db.collection('broadcasts').updateOne({ _id: jobId }, {
                            $inc: { successCount: successThisInterval, errorCount: errorsThisInterval },
                        });
                    }

                    const intervalEndTime = Date.now();
                    const duration = intervalEndTime - intervalStartTime;
                    const delay = 1000 - duration;

                    if (hasMoreContacts && delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                const finalJobState = await db.collection('broadcasts').findOne({_id: jobId});
                const jobSuccessCount = finalJobState?.successCount || 0;
                const jobErrorCount = finalJobState?.errorCount || 0;

                const finalStatus: 'Completed' | 'Partial Failure' | 'Failed' = jobErrorCount > 0
                    ? (jobSuccessCount > 0 ? 'Partial Failure' : 'Failed')
                    : 'Completed';

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
