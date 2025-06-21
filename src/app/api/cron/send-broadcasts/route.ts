
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
    logs?: string[];
};

export async function GET(request: Request) {
    return new NextResponse('This endpoint is for the automated broadcast sending cron job. It is triggered automatically and only accepts POST requests.', { status: 200 });
}

// Helper function to update logs in the DB
async function updateLogs(db: Db, jobId: ObjectId, logs: string[]) {
    if (logs.length === 0) return;
    try {
        await db.collection('broadcasts').updateOne(
            { _id: jobId },
            { $push: { logs: { $each: logs } } }
        );
        logs.length = 0; // Clear the array for the next batch of logs
    } catch (e) {
        console.error(`CRON JOB: Failed to update logs for job ${jobId}`, e);
    }
}


export async function POST(request: Request) {
    console.log(`[${new Date().toISOString()}] CRON JOB: Triggered.`);
    const logBuffer: string[] = [];
    const log = (message: string) => {
        const logMessage = `[${new Date().toISOString()}] ${message}`;
        console.log(`CRON JOB: ${logMessage}`);
        logBuffer.push(logMessage);
    };
    
    let db: Db;
    let jobId: ObjectId | null = null;

    try {
        const isCron = request.headers.get('X-App-Hosting-Cron');
        if (!isCron) {
            console.error(`[${new Date().toISOString()}] CRON JOB: Unauthorized access. Missing X-App-Hosting-Cron header.`);
            return new NextResponse('Unauthorized', { status: 401 });
        }
        console.log(`[${new Date().toISOString()}] CRON JOB: Cron header verified.`);

        log('Connecting to database...');
        const conn = await connectToDatabase();
        db = conn.db;
        log('Database connected.');
        
        log('Searching for a queued broadcast job...');
        const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', processedAt: new Date() } },
            { returnDocument: 'after', sort: { createdAt: 1 } }
        );

        if (!job) {
            console.log(`[${new Date().toISOString()}] CRON JOB: No queued broadcasts to process.`);
            return NextResponse.json({ message: 'No queued broadcasts to process.' });
        }

        jobId = job._id;
        log(`Found and processing broadcast job ${jobId}.`);
        await updateLogs(db, jobId, logBuffer);


        // --- Start of inner try...catch block for job processing ---
        try {
            let successCount = 0;
            let successfulSends: { phone: string; response: any }[] = [];
            let failedSends: { phone: string; response: any }[] = [];
            
            const CHUNK_SIZE = 80;
            const DELAY_MS = 1000;

            log(`Starting to send messages to ${job.contacts.length} contacts in chunks of ${CHUNK_SIZE}...`);
            await updateLogs(db, jobId, logBuffer);


            for (let i = 0; i < job.contacts.length; i += CHUNK_SIZE) {
                const chunk = job.contacts.slice(i, i + CHUNK_SIZE);
                const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
                log(`Processing chunk ${chunkNumber} of ${Math.ceil(job.contacts.length / CHUNK_SIZE)}...`);
                
                const sendPromises = chunk.map(async (contact) => {
                    const firstColumnHeader = Object.keys(contact)[0];
                    const phone = contact[firstColumnHeader];
                    log(`  - Processing contact: ${phone}`);

                    const getVars = (text: string): number[] => {
                        const variableMatches = text.match(/{{(\d+)}}/g);
                        return variableMatches ? [...new Set(variableMatches.map(v => parseInt(v.match(/(\d+)/)![1])))] : [];
                    };
                    
                    const payloadComponents: any[] = [];
                    
                    // HEADER COMPONENT
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
                                log(`    - Added TEXT header with params: ${JSON.stringify(parameters)}`);
                            }
                        } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerComponent.format)) {
                            const mediaId = headerComponent.example?.header_handle?.[0];
                            if (mediaId) {
                                const type = headerComponent.format.toLowerCase();
                                parameters.push({ type, [type]: { id: mediaId } });
                                log(`    - Added ${type.toUpperCase()} header with media ID: ${mediaId}`);
                            } else {
                                log(`    - WARNING: Template has ${headerComponent.format} header but no media handle was found.`);
                            }
                        }
                        if (parameters.length > 0) {
                            payloadComponents.push({ type: 'header', parameters });
                        }
                    }

                    // BODY COMPONENT
                    const bodyComponent = job.components.find(c => c.type === 'BODY');
                    if (bodyComponent?.text) {
                        const bodyVars = getVars(bodyComponent.text);
                        if (bodyVars.length > 0) {
                            const parameters = bodyVars.sort((a,b) => a-b).map(varNum => ({
                                type: 'text',
                                text: contact[`variable${varNum}`] || '',
                            }));
                            payloadComponents.push({ type: 'body', parameters });
                            log(`    - Added BODY with params: ${JSON.stringify(parameters)}`);
                        }
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

                    log(`    - Payload for ${phone}: ${JSON.stringify(messageData)}`);

                    try {
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
                
                log(`Chunk ${chunkNumber} finished. So far: ${successfulSends.length} success, ${failedSends.length} failed.`);


                if (i + CHUNK_SIZE < job.contacts.length) {
                    log(`Waiting for ${DELAY_MS}ms...`);
                    await updateLogs(db, jobId, logBuffer);
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            }


            const errorCount = failedSends.length;
            let finalStatus: 'Completed' | 'Partial Failure' | 'Failed' = 'Completed';
            if (errorCount > 0) {
              finalStatus = successCount > 0 ? 'Partial Failure' : 'Failed';
            }
            
            log('Finished sending all messages. Updating job status in database...');
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
                    },
                     $push: { logs: { $each: logBuffer } }
                }
            );
            
            console.log(`[${new Date().toISOString()}] CRON JOB: Broadcast job ${jobId} finished with status: ${finalStatus}. Success: ${successCount}, Failed: ${errorCount}.`);
            return NextResponse.json({ message: `Job ${jobId} processed.`, status: finalStatus, success: successCount, failed: errorCount });
        } catch (processingError: any) {
            const errorMessage = `CRON JOB: Error during processing job ${jobId}: ${processingError.message}`;
            log(errorMessage);
            console.error(errorMessage, processingError);

            await db.collection('broadcasts').updateOne(
                { _id: jobId },
                {
                    $set: { status: 'Failed', processedAt: new Date() },
                    $push: { logs: { $each: logBuffer } }
                }
            );
            return new NextResponse(`Internal Server Error while-processing job: ${processingError.message}`, { status: 500 });
        }
    } catch (error: any) {
        // This outer catch handles initial setup errors (DB connection, finding the job)
        const errorMessage = `[${new Date().toISOString()}] CRON JOB FAILED: ${error.message}`;
        console.error(errorMessage, error);
        
        if (jobId && db) {
             await db.collection('broadcasts').updateOne(
                { _id: jobId },
                {
                    $set: { status: 'Failed', processedAt: new Date() },
                    $push: { logs: { $each: [errorMessage, ...logBuffer] } }
                }
            );
        }
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
