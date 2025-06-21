
import { config } from 'dotenv';
config();

import { NextResponse } from 'next/server';
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
    processedAt?: Date;
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

async function handleRequest(request: Request) {
    let db: Db;
    let jobId: ObjectId | null = null;
    
    try {
        const conn = await connectToDatabase();
        db = conn.db;

        const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { 
                $set: { 
                    status: 'PROCESSING', 
                    processedAt: new Date(),
                    successCount: 0,
                    errorCount: 0,
                    successfulSends: [],
                    failedSends: []
                } 
            },
            { returnDocument: 'after', sort: { createdAt: 1 } }
        );

        if (!job) {
             return NextResponse.json({ message: 'No queued broadcasts to process.' });
        }

        jobId = job._id;

        const project = await db.collection<Project>('projects').findOne({ _id: job.projectId });
        const CHUNK_SIZE = project?.messagesPerSecond || 80;
        
        let mediaId: string | null = null;
        try {
            const headerComponent = job.components.find(c => c.type === 'HEADER');
            if (headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerComponent.format)) {
                const broadcastSpecificUrl = job.headerImageUrl;
                const templateDefaultUrl = headerComponent.example?.header_url?.[0];
                let finalUrl;
                if (broadcastSpecificUrl) {
                    finalUrl = broadcastSpecificUrl.startsWith('http') ? broadcastSpecificUrl : `${process.env.APP_URL || ''}${broadcastSpecificUrl}`;
                } else {
                    finalUrl = templateDefaultUrl;
                }

                if (finalUrl) {
                    const mediaResponse = await fetch(finalUrl);
                    if (!mediaResponse.ok) throw new Error(`Failed to fetch media from URL: ${finalUrl}`);
                    
                    const fileBuffer = Buffer.from(await mediaResponse.arrayBuffer());
                    const filename = finalUrl.split('/').pop()?.split('?')[0] || 'media-file';

                    const formData = new FormData();
                    formData.append('messaging_product', 'whatsapp');
                    formData.append('file', fileBuffer, { filename });
                    
                    const uploadResponse = await axios.post(
                        `https://graph.facebook.com/v22.0/${job.phoneNumberId}/media`,
                        formData,
                        {
                            headers: {
                                'Authorization': `Bearer ${job.accessToken}`,
                                ...formData.getHeaders(),
                            },
                        }
                    );
                    
                    const uploadData = uploadResponse.data;
                    
                    await db.collection('broadcasts').updateOne({ _id: jobId }, { $set: { debug: { mediaUploadResponse: uploadData } } });

                    if (uploadResponse.status !== 200 || !uploadData.id) {
                        throw new Error(`Meta media upload failed: ${JSON.stringify(uploadData.error || uploadData)}`);
                    }
                    mediaId = uploadData.id;
                    await db.collection('broadcasts').updateOne({ _id: jobId }, { $set: { 'debug.mediaId': mediaId } });
                }
            }
        } catch (mediaError: any) {
            const errorMessage = mediaError.response?.data?.error?.message || mediaError.message;
            if (jobId && db) {
                await db.collection('broadcasts').updateOne({ _id: jobId }, { $set: { status: 'Failed', failedSends: [{ phone: 'N/A', response: { error: { message: `Media Upload Failed: ${errorMessage}` } }, payload: {} }] } });
            }
            return new NextResponse(`Internal Server Error during media upload: ${errorMessage}`, { status: 500 });
        }


        try {
            let totalSuccessCount = 0;
            let totalErrorCount = 0;
            
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
                                        parameters.push({
                                            type: 'text',
                                            text: contact[`variable${varNum}`] || '',
                                        });
                                    });
                                }
                            } else if (mediaId) {
                                 const type = headerComponent.format.toLowerCase();
                                 const mediaObject: any = { id: mediaId };
                                 if (type === 'document') {
                                    mediaObject.filename = contact['filename'] || uploadFilename; 
                                 }
                                 parameters.push({ type, [type]: mediaObject });
                            }
                            if (parameters.length > 0) {
                                payloadComponents.push({ type: 'header', parameters });
                            }
                        }

                        const bodyComponent = job.components.find(c => c.type === 'BODY');
                        if (bodyComponent?.text) {
                            const bodyVars = getVars(bodyComponent.text);
                            if (bodyVars.length > 0) {
                                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => ({
                                    type: 'text',
                                    text: contact[`variable${varNum}`] || '',
                                }));
                                payloadComponents.push({ type: 'body', parameters });
                            }
                        }

                        const buttonsComponent = job.components.find(c => c.type === 'BUTTONS');
                        if (buttonsComponent) {
                            payloadComponents.push(buttonsComponent);
                        }
                        
                        messageData = {
                            messaging_product: 'whatsapp',
                            to: phone,
                            recipient_type: 'individual',
                            type: 'template',
                            template: {
                                name: job.templateName,
                                language: { code: job.language || 'en_US' },
                                ...(payloadComponents.length > 0 && { components: payloadComponents }),
                            },
                        };

                        const response = await fetch(
                          `https://graph.facebook.com/v22.0/${job.phoneNumberId}/messages`,
                          {
                            method: 'POST',
                            headers: {
                              Authorization: `Bearer ${job.accessToken}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(messageData),
                          }
                        );

                        const responseData = await response.json();

                        if (response.ok) {
                            chunkSuccessfulSends.push({ phone, response: responseData, payload: messageData });
                        } else {
                            chunkFailedSends.push({ phone, response: responseData, payload: messageData });
                        }
                    } catch(e: any) {
                        chunkFailedSends.push({ phone, response: { error: { message: e.message || 'Exception during fetch' } }, payload: messageData});
                    }
                });

                await Promise.all(sendPromises);
                
                if (chunkSuccessfulSends.length > 0 || chunkFailedSends.length > 0) {
                    totalSuccessCount += chunkSuccessfulSends.length;
                    totalErrorCount += chunkFailedSends.length;
                    
                    await db.collection('broadcasts').updateOne(
                        { _id: jobId },
                        {
                            $inc: {
                                successCount: chunkSuccessfulSends.length,
                                errorCount: chunkFailedSends.length,
                            },
                            $push: {
                                successfulSends: { $each: chunkSuccessfulSends },
                                failedSends: { $each: chunkFailedSends },
                            }
                        }
                    );
                }
            }

            const finalStatus: 'Completed' | 'Partial Failure' | 'Failed' = totalErrorCount > 0
                ? (totalSuccessCount > 0 ? 'Partial Failure' : 'Failed')
                : 'Completed';
            
            await db.collection('broadcasts').updateOne(
                { _id: jobId },
                {
                    $set: {
                        status: finalStatus,
                        processedAt: new Date(),
                    }
                }
            );

            return NextResponse.json({ message: `Job ${jobId} processed.`, status: finalStatus, success: totalSuccessCount, failed: totalErrorCount });
        
        } catch (processingError: any) {
            if (jobId && db) {
                await db.collection('broadcasts').updateOne(
                    { _id: jobId },
                    {
                        $set: { status: 'Failed', processedAt: new Date() },
                    }
                );
            }
             return new NextResponse(`Internal Server Error while-processing job: ${processingError.message}`, { status: 500 });
        }
    } catch (error: any) {
        if (jobId && db) {
             await db.collection('broadcasts').updateOne(
                { _id: jobId },
                {
                    $set: { status: 'Failed', processedAt: new Date() },
                }
            );
        }
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

export async function GET(request: Request) {
    return handleRequest(request);
}

export async function POST(request: Request) {
    return handleRequest(request);
}
