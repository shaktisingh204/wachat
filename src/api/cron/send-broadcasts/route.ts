
import { config } from 'dotenv';
config();

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';

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
    successfulSends?: { phone: string; response: any }[];
    failedSends?: { phone: string; response: any }[];
    components: any[]; 
    language: string;
    headerImageUrl?: string;
};

type Project = {
    _id: ObjectId;
    rateLimitDelay?: number;
};

async function handleRequest(request: Request) {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;

    } catch (initializationError: any) {
        return new NextResponse(`Internal Server Error during initialization: ${initializationError.message}`, { status: 500 });
    }

    let jobId: ObjectId | null = null;

    try {
        const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', processedAt: new Date() } },
            { returnDocument: 'after', sort: { createdAt: 1 } }
        );

        if (!job) {
            return NextResponse.json({ message: 'No queued broadcasts to process.' });
        }

        jobId = job._id;
        
        const project = await db.collection<Project>('projects').findOne({ _id: job.projectId });
        const DELAY_MS = project?.rateLimitDelay || 1000;

        try {
            let successCount = 0;
            let successfulSends: { phone: string; response: any }[] = [];
            let failedSends: { phone: string; response: any }[] = [];
            
            const CHUNK_SIZE = 80;

            for (let i = 0; i < job.contacts.length; i += CHUNK_SIZE) {
                const chunk = job.contacts.slice(i, i + CHUNK_SIZE);
                
                const sendPromises = chunk.map(async (contact) => {
                    const firstColumnHeader = Object.keys(contact)[0];
                    const phone = contact[firstColumnHeader];

                    try {
                        // --- PAYLOAD CONSTRUCTION ---
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
                            } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerComponent.format)) {
                                const broadcastSpecificUrl = job.headerImageUrl;
                                const templateDefaultUrl = headerComponent.example?.header_url?.[0];

                                let finalUrl;
                                if (broadcastSpecificUrl) {
                                    finalUrl = broadcastSpecificUrl.startsWith('http') ? broadcastSpecificUrl : `${process.env.APP_URL || ''}${broadcastSpecificUrl}`;
                                } else {
                                    finalUrl = templateDefaultUrl;
                                }

                                if (finalUrl) {
                                    const type = headerComponent.format.toLowerCase();
                                    const mediaObject: any = { link: finalUrl };
                                    if (type === 'document') {
                                    mediaObject.filename = contact['filename'] || "file"; 
                                    }
                                    parameters.push({ type, [type]: mediaObject });
                                }
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
                        
                        const messageData = {
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
                          `https://graph.facebook.com/v18.0/${job.phoneNumberId}/messages`,
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
                            successfulSends.push({ phone: phone, response: responseData });
                            successCount++;
                        } else {
                            failedSends.push({ phone: phone, response: responseData });
                        }
                    } catch(e: any) {
                        const errorResponse = { error: { message: e.message || 'Exception during fetch', status: 'CLIENT_FAILURE' } };
                        failedSends.push({ phone: phone, response: errorResponse });
                    }
                });

                await Promise.all(sendPromises);
                
                if (i + CHUNK_SIZE < job.contacts.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            }


            const errorCount = failedSends.length;
            let finalStatus: 'Completed' | 'Partial Failure' | 'Failed' = 'Completed';
            if (errorCount > 0) {
              finalStatus = successCount > 0 ? 'Partial Failure' : 'Failed';
            }
            
            await db.collection('broadcasts').updateOne(
                { _id: jobId },
                {
                    $set: {
                        status: finalStatus,
                        successCount,
                        errorCount,
                        successfulSends,
                        failedSends,
                        processedAt: new Date(),
                    }
                }
            );
            
            return NextResponse.json({ message: `Job ${jobId} processed.`, status: finalStatus, success: successCount, failed: errorCount });
        } catch (processingError: any) {
            await db.collection('broadcasts').updateOne(
                { _id: jobId },
                {
                    $set: { status: 'Failed', processedAt: new Date() },
                }
            );
            return new NextResponse(`Internal Server Error while-processing job: ${processingError.message}`, { status: 500 });
        }
    } catch (error: any) {
        if (jobId) {
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
