
'use server';

import { config } from 'dotenv';
config();

import cron from 'node-cron';
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

async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
    } catch (initializationError: any) {
        console.error(`[${new Date().toISOString()}] CRON SCHEDULER FAILED TO INITIALIZE DB: ${initializationError.message}`);
        // Cannot log to DB if connection fails, so we just log to console.
        return;
    }

    let jobId: ObjectId | null = null;
    const logBuffer: string[] = [];
    const log = (message: string) => {
        const logMessage = `[${new Date().toISOString()}] ${message}`;
        console.log(`CRON SCHEDULER: ${logMessage}`);
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
            log('No queued broadcasts to process.');
            // This is a normal state, so we don't log to the cron_logs collection unless we want verbosity.
            return;
        }

        jobId = job._id;
        const startMsg = `Found and processing broadcast job ${jobId}.`;
        log(startMsg);
        await logToCronCollection(db, 'INFO', startMsg, { jobId: jobId.toString() });
        await updateLogs(db, jobId, logBuffer);

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
                        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format)) {
                             const mediaId = headerComponent.example?.header_handle?.[0];
                             if (mediaId) {
                                 const type = headerComponent.format.toLowerCase();
                                 const mediaObject: any = { id: mediaId };
                                 if (type === 'document') {
                                    mediaObject.filename = contact['filename'] || "file"; 
                                 }
                                 parameters.push({ type, [type]: mediaObject });
                             }
                        } else if (headerComponent.format === 'AUDIO'){
                            const mediaId = headerComponent.example?.header_handle?.[0];
                            if(mediaId){
                                parameters.push({type: 'audio', audio: {id: mediaId}});
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
            
            console.log(`[${new Date().toISOString()}] CRON SCHEDULER: Broadcast job ${jobId} finished with status: ${finalStatus}. Success: ${successCount}, Failed: ${errorCount}.`);
        
        } catch (processingError: any) {
            const errorMessage = `CRON SCHEDULER: Error during processing job ${jobId}: ${processingError.message}`;
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
        }
    } catch (error: any) {
        const errorMessage = `CRON SCHEDULER FAILED: ${error.message}`;
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
    }
}


export function startScheduler() {
  // This task runs every minute.
  cron.schedule('* * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Cron scheduler triggered.`);
    try {
        await processBroadcastJob();
    } catch (e: any) {
        console.error(`[${new Date().toISOString()}] FATAL: Unhandled error in cron scheduler:`, e);
        try {
            const { db } = await connectToDatabase();
            await logToCronCollection(db, 'ERROR', 'Cron scheduler top-level error.', { error: e.message, stack: e.stack });
        } catch (dbError) {
            console.error(`[${new Date().toISOString()}] FATAL: Could not log top-level cron error to DB.`, dbError);
        }
    }
  });

  console.log('Broadcast scheduler initialized with node-cron.');
}
