
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
    contacts: Record<string, string>[];
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
};

type Project = {
    _id: ObjectId;
    messagesPerSecond?: number;
};


const getAxiosErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message;
        const details = error.response?.data?.error ? ` (Code: ${error.response.data.error.code}, Type: ${error.response.data.error.type})` : '';
        return `${message}${details}`;
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

        // This loop will continue to fetch and process jobs until the queue is empty.
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

            // If no job is found, the queue is empty. Break the loop.
            if (!job) {
                break;
            }

            const jobId = job._id;
            
            // This inner try-catch ensures that one failed job doesn't stop the entire cron run.
            try {
                const project = await db.collection<Project>('projects').findOne({ _id: job.projectId });
                const CHUNK_SIZE = project?.messagesPerSecond || 80;

                let mediaId: string | null = null;
                const headerComponent = job.components.find(c => c.type === 'HEADER');
                if (headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerComponent.format)) {
                    const templateDefaultUrl = headerComponent.example?.header_handle?.[0];
                    const finalUrl = job.headerImageUrl || templateDefaultUrl;

                    if (finalUrl) {
                        const mediaResponse = await axios.get(finalUrl, { responseType: 'arraybuffer' });
                        
                        const fileBuffer = Buffer.from(mediaResponse.data, 'binary');
                        const filename = finalUrl.split('/').pop()?.split('?')[0] || 'media-file';
                        const mediaType = mediaResponse.headers['content-type'] || 'application/octet-stream';

                        const formData = new FormData();
                        formData.append('messaging_product', 'whatsapp');
                        formData.append('file', fileBuffer, { filename: filename, contentType: mediaType });
                        
                        const uploadResponse = await axios.post(
                            `https://graph.facebook.com/v22.0/${job.phoneNumberId}/media`,
                            formData,
                            { headers: { 'Authorization': `Bearer ${job.accessToken}`, ...formData.getHeaders() } }
                        );
                        
                        if (!uploadResponse.data.id) {
                            throw new Error(`Meta media upload failed: ${JSON.stringify(uploadResponse.data.error || uploadResponse.data)}`);
                        }
                        mediaId = uploadResponse.data.id;
                    }
                }
                
                const uploadFilename = job.headerImageUrl?.split('/').pop()?.split('?')[0] || 'media-file';

                for (let i = 0; i < job.contacts.length; i += CHUNK_SIZE) {
                    const chunk = job.contacts.slice(i, i + CHUNK_SIZE);
                    const chunkSuccessfulSends: SuccessfulSend[] = [];
                    const chunkFailedSends: FailedSend[] = [];

                    const sendPromises = chunk.map(async (contact) => {
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
                                } else if (mediaId) {
                                     const type = headerComponent.format.toLowerCase();
                                     const mediaObject: any = { id: mediaId };
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

                        } catch(error: any) {
                            const errorResponse = error.response?.data || { error: { message: getAxiosErrorMessage(error) } };
                            chunkFailedSends.push({ phone, response: errorResponse, payload: messageData });
                        }
                    });

                    await Promise.all(sendPromises);
                    
                    if (chunkSuccessfulSends.length > 0 || chunkFailedSends.length > 0) {
                        await db.collection('broadcasts').updateOne({ _id: jobId }, {
                            $inc: { successCount: chunkSuccessfulSends.length, errorCount: chunkFailedSends.length },
                            $push: { successfulSends: { $each: chunkSuccessfulSends }, failedSends: { $each: chunkFailedSends } }
                        });
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
                const errorCount = job.contacts?.length || 0;
                totalErrorCountAllJobs += errorCount;
                await db.collection('broadcasts').updateOne(
                    { _id: jobId },
                    { $set: { status: 'Failed', completedAt: new Date(), errorCount, successCount: 0, failedSends: [{ phone: 'N/A', response: { error: { message: getAxiosErrorMessage(processingError) } }, payload: {} }] } }
                );
                processedJobsSummary.push({ jobId: jobId.toString(), status: 'Failed', error: getAxiosErrorMessage(processingError) });
            }
        } // End of while loop

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
