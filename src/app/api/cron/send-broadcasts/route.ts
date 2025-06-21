
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
    const logBuffer: string[] = [];
    const log = (message: string) => {
        const logMessage = `[${new Date().toISOString()}] ${message}`;
        console.log(`CRON JOB: ${logMessage}`); // Keep console logs for server-side debugging
        logBuffer.push(logMessage);
    };
    
    log('Triggered.');

    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
        console.error('CRON JOB: Unauthorized access. Invalid or missing secret.');
        return new NextResponse('Unauthorized', { status: 401 });
    }

    let db: Db;
    let jobId: ObjectId | null = null;

    try {
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
            console.log('CRON JOB: No queued broadcasts to process.');
            return NextResponse.json({ message: 'No queued broadcasts to process.' });
        }

        jobId = job._id;
        log(`Found and processing broadcast job ${jobId}.`);
        await updateLogs(db, jobId, logBuffer);


        let successCount = 0;
        let successfulSends: { phone: string; response: any }[] = [];
        let failedSends: { phone: string; response: any }[] = [];
        
        const CHUNK_SIZE = 80;
        const DELAY_MS = 1000; // 1 second delay between chunks

        log(`Starting to send messages to ${job.contacts.length} contacts in chunks of ${CHUNK_SIZE}...`);
        await updateLogs(db, jobId, logBuffer);


        for (let i = 0; i < job.contacts.length; i += CHUNK_SIZE) {
            const chunk = job.contacts.slice(i, i + CHUNK_SIZE);
            const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
            log(`Processing chunk ${chunkNumber} of ${Math.ceil(job.contacts.length / CHUNK_SIZE)}...`);
            
            const sendPromises = chunk.map(async (contact) => {

                const getVars = (text: string): number[] => {
                    const variableMatches = text.match(/{{(\d+)}}/g);
                    return variableMatches ? [...new Set(variableMatches.map(v => parseInt(v.match(/(\d+)/)![1])))] : [];
                };
                
                const payloadComponents: any[] = [];

                // Process Header
                const headerComponent = job.components.find(c => c.type === 'HEADER');
                if (headerComponent?.text) {
                    const headerVars = getVars(headerComponent.text);
                    if (headerVars.length > 0) {
                        const parameters = headerVars.sort((a,b) => a-b).map(varNum => ({
                            type: 'text',
                            text: contact[`variable${varNum}`] || '',
                        }));
                        payloadComponents.push({ type: 'header', parameters });
                    }
                }

                // Process Body
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
                    to: contact.phone,
                    recipient_type: 'individual',
                    type: 'template',
                    template: {
                        name: job.templateName,
                        language: { code: job.language || 'en_US' },
                        ...(payloadComponents.length > 0 && { components: payloadComponents }),
                    },
                };

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
                        successfulSends.push({ phone: contact.phone, response: responseData });
                        successCount++;
                    } else {
                        failedSends.push({ phone: contact.phone, response: responseData });
                    }
                } catch(e: any) {
                    const errorResponse = { error: { message: e.message || 'Exception during fetch', status: 'CLIENT_FAILURE' } };
                    failedSends.push({ phone: contact.phone, response: errorResponse });
                }
            });

            await Promise.all(sendPromises);
            
            const currentSuccess = successfulSends.length - (successCount - chunk.length);
            const currentFailed = failedSends.length - (job.contacts.length - successCount - chunk.length);
            log(`Chunk ${chunkNumber} finished. Sent: ${chunk.length}, Success: ${currentSuccess}, Failed: ${currentFailed}.`);


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
        
        console.log(`CRON JOB: Broadcast job ${jobId} finished with status: ${finalStatus}. Success: ${successCount}, Failed: ${errorCount}.`);
        return NextResponse.json({ message: `Job ${jobId} processed.`, status: finalStatus, success: successCount, failed: errorCount });

    } catch (error: any) {
        const errorMessage = `CRON JOB FAILED: ${error.message}`;
        log(errorMessage);
        if (db! && jobId) {
             await db.collection('broadcasts').updateOne(
                { _id: jobId },
                {
                    $set: { status: 'Failed', processedAt: new Date() },
                    $push: { logs: { $each: logBuffer } }
                }
            );
        }
        console.error(errorMessage, error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
