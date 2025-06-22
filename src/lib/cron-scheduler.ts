
'use server';

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';
import axios from 'axios';
import FormData from 'form-data';

type SuccessfulSend = {
    phone: string;
    response: any;
    payload: any;
};

type FailedSend = {
    phone: string;
    response: any;
    payload: any;
};

type BroadcastJob = {
    _id: ObjectId;
    projectId: ObjectId;
    templateId: ObjectId;
    templateName: string;
    phoneNumberId: string;
    accessToken: string;
    status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Partial Failure' | 'Failed';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    successCount?: number;
    errorCount?: number;
    successfulSends?: SuccessfulSend[];
    failedSends?: FailedSend[];
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
}

type Project = {
    _id: ObjectId;
    messagesPerSecond?: number;
};


const getAxiosErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error)) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            const apiError = error.response.data?.error;
            if (apiError) {
                return `${apiError.message || 'API Error'} (Code: ${apiError.code}, Type: ${apiError.type})`;
            }
            return `Request failed with status code ${error.response.status}`;
        } else if (error.request) {
            // The request was made but no response was received
            return 'No response received from server. Check network connectivity.';
        } else {
            // Something happened in setting up the request that triggered an Error
            return error.message;
        }
    }
    return error.message || 'An unknown error occurred';
};


export async function processBroadcastJob() {
    let db: Db;
    const processedJobsSummary = [];
    let totalSuccessCountAllJobs = 0;
    let totalErrorCountAllJobs = 0;

    try {
        const conn = await connectToDatabase();
        db = conn.db;

        while (true) {
            const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
                { status: 'QUEUED' },
                { 
                    $set: { 
                        status: 'PROCESSING', 
                        startedAt: new Date(),
                        successCount: 0,
                        errorCount: 0,
                        successfulSends: [],
                        failedSends: []
                    } 
                },
                { returnDocument: 'after', sort: { createdAt: 1 } }
            );

            if (!job) {
                break;
            }

            const jobId = job._id;
            
            try {
                const project = await db.collection<Project>('projects').findOne({ _id: job.projectId });
                const CHUNK_SIZE = project?.messagesPerSecond || 80;

                let mediaId: string | null = null;
                const headerComponent = job.components.find(c => c.type === 'HEADER');
                
                if (headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerComponent.format)) {
                     // This feature is removed as it's not compatible with serverless read-only filesystems.
                     // A URL must be provided in the broadcast form.
                }
                
                const uploadFilename = job.headerImageUrl?.split('/').pop()?.split('?')[0] || 'media-file';

                let hasMoreContacts = true;
                while (hasMoreContacts) {
                    const contactsToProcess = await db.collection<BroadcastContact>('broadcast_contacts').find({
                        broadcastId: jobId,
                        status: 'PENDING'
                    }).limit(CHUNK_SIZE).toArray();

                    if (contactsToProcess.length === 0) {
                        hasMoreContacts = false;
                        continue;
                    }

                    const chunkSuccessfulSends: SuccessfulSend[] = [];
                    const chunkFailedSends: FailedSend[] = [];
                    const successfulContactIds: ObjectId[] = [];
                    const failedContactIds: ObjectId[] = [];

                    const sendPromises = contactsToProcess.map(async (contactDoc) => {
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
                                     // For non-text headers, we use an image URL provided at broadcast time.
                                     // This assumes the URL is publicly accessible. Direct upload to Meta is no longer used.
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
                                    if (button.type === 'QUICK_REPLY' && contact[`button_payload_${index}`]) {
                                        payloadComponents.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload: contact[`button_payload_${index}`] }] });
                                    } else if (button.type === 'URL' && button.url?.includes('{{1}}') && contact[`button_url_text_0`]) {
                                        payloadComponents.push({ type: 'button', sub_type: 'url', index: String(index), parameters: [{ type: 'text', text: contact[`button_url_text_0`] }] });
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

                            chunkSuccessfulSends.push({ phone, response: response.data, payload: messageData });
                            successfulContactIds.push(contactDoc._id);

                        } catch(error: any) {
                            const errorResponse = error.response?.data || { error: { message: getAxiosErrorMessage(error) } };
                            chunkFailedSends.push({ phone, response: errorResponse, payload: messageData });
                            failedContactIds.push(contactDoc._id);
                        }
                    });

                    await Promise.all(sendPromises);
                    
                    if (chunkSuccessfulSends.length > 0 || chunkFailedSends.length > 0) {
                        await db.collection('broadcasts').updateOne({ _id: jobId }, {
                            $inc: { successCount: chunkSuccessfulSends.length, errorCount: chunkFailedSends.length },
                            $push: { successfulSends: { $each: chunkSuccessfulSends }, failedSends: { $each: chunkFailedSends } }
                        });
                    }

                    if (successfulContactIds.length > 0) {
                        await db.collection('broadcast_contacts').updateMany(
                            { _id: { $in: successfulContactIds } },
                            { $set: { status: 'SENT' } }
                        );
                    }
                    if (failedContactIds.length > 0) {
                        await db.collection('broadcast_contacts').updateMany(
                            { _id: { $in: failedContactIds } },
                            { $set: { status: 'FAILED' } }
                        );
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

        if (processedJobsSummary.length === 0) {
            return { message: 'No queued broadcasts to process.' };
        }

        return {
            message: `Processed ${processedJobsSummary.length} broadcast(s).`,
            totalSuccess: totalSuccessCountAllJobs,
            totalFailed: totalErrorCountAllJobs,
            jobs: processedJobsSummary,
        };

    } catch (error: any) {
        console.error("Cron scheduler failed:", getAxiosErrorMessage(error));
        throw new Error(`Cron scheduler failed: ${getAxiosErrorMessage(error)}`);
    }
}
