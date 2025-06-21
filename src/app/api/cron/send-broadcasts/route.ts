
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

// Helper to log to the general cron log collection
const logToCronCollection = async (db: Db, level: 'INFO' | 'ERROR', message: string, details: any = {}) => {
    try {
        await db.collection('cron_logs').insertOne({
            timestamp: new Date(),
            level,
            message,
            details,
        });
    } catch (e) {
        console.error('CRON: FATAL - Could not write to cron_logs collection.', e);
    }
};


// Helper function to update logs in the DB for a specific job
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
    let db: Db;
    // Initialization block
    try {
        const isCron = request.headers.get('X-App-Hosting-Cron');
        if (!isCron) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        
        const conn = await connectToDatabase();
        db = conn.db;

        await logToCronCollection(db, 'INFO', 'Cron job triggered by scheduler.');

    } catch (initializationError: any) {
        console.error(`[${new Date().toISOString()}] CRON JOB FAILED TO INITIALIZE: ${initializationError.message}`);
        return new NextResponse(`Internal Server Error during initialization: ${initializationError.message}`, { status: 500 });
    }

    // Processing block
    let jobId: ObjectId | null = null;
    const logBuffer: string[] = [];
    const log = (message: string) => {
        const logMessage = `[${new Date().toISOString()}] ${message}`;
        console.log(`CRON JOB: ${logMessage}`);
        logBuffer.push(logMessage);
    };

    try {
        log('Searching for a queued broadcast job...');
        const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', processedAt: new Date() } },
            { returnDocument: 'after', sort: { createdAt: 1 } }
        );

        if (!job) {
            await logToCronCollection(db, 'INFO', 'No queued broadcasts to process.');
            return NextResponse.json({ message: 'No queued broadcasts to process.' });
        }

        jobId = job._id;
        const startMsg = `Found and processing broadcast job ${jobId}.`;
        log(startMsg);
        await logToCronCollection(db, 'INFO', startMsg, { jobId: jobId.toString() });
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
                             const mediaId = headerComponent.example?.header_handle?.[0];
                             if (mediaId) {
                                 const type = headerComponent.format.toLowerCase();
                                 const mediaObject: any = { id: mediaId };
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
            
            const finalMsg = `Finished sending all messages. Updating job status to ${finalStatus}.`;
            log(finalMsg);
            await logToCronCollection(db, 'INFO', finalMsg, { jobId: jobId.toString(), successCount, errorCount });
            
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
            await logToCronCollection(db, 'ERROR', errorMessage, { jobId: jobId.toString(), stack: processingError.stack });
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
        const errorMessage = `CRON JOB FAILED: ${error.message}`;
        console.error(errorMessage, error);
        
        await logToCronCollection(db, 'ERROR', errorMessage, { stack: error.stack });
        
        if (jobId) {
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
