
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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
};

export async function POST(request: Request) {
    console.log('CRON JOB: Triggered at:', new Date().toISOString());
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
        console.error('CRON JOB: Unauthorized access. Invalid or missing secret.');
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log('CRON JOB: Connecting to database...');
        const { db } = await connectToDatabase();
        console.log('CRON JOB: Database connected. Searching for a queued broadcast job...');

        const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', processedAt: new Date() } },
            { returnDocument: 'after', sort: { createdAt: 1 } }
        );

        if (!job) {
            console.log('CRON JOB: No queued broadcasts to process.');
            return NextResponse.json({ message: 'No queued broadcasts to process.' });
        }

        console.log(`CRON JOB: Found and processing broadcast job ${job._id}.`);

        let successCount = 0;
        let successfulSends: { phone: string; response: any }[] = [];
        let failedSends: { phone: string; response: any }[] = [];
        
        const CHUNK_SIZE = 80;
        const DELAY_MS = 1000; // 1 second delay between chunks

        console.log(`CRON JOB: Starting to send messages to ${job.contacts.length} contacts in chunks of ${CHUNK_SIZE}...`);

        for (let i = 0; i < job.contacts.length; i += CHUNK_SIZE) {
            const chunk = job.contacts.slice(i, i + CHUNK_SIZE);
            console.log(`CRON JOB: Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}...`);
            
            const sendPromises = chunk.map(async (contact) => {

                const getVars = (text: string): number[] => {
                    const variableMatches = text.match(/{{(\d+)}}/g);
                    return variableMatches ? [...new Set(variableMatches.map(v => parseInt(v.match(/(\d+)/)![1])))] : [];
                };
                
                const payloadComponents: any[] = [];

                // Process Header
                const headerComponent = job.components.find(c => c.type === 'HEADER' && c.format === 'TEXT');
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

            if (i + CHUNK_SIZE < job.contacts.length) {
                console.log(`CRON JOB: Chunk finished. Waiting for ${DELAY_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }


        const errorCount = failedSends.length;
        let finalStatus: 'Completed' | 'Partial Failure' | 'Failed' = 'Completed';
        if (errorCount > 0) {
          finalStatus = successCount > 0 ? 'Partial Failure' : 'Failed';
        }
        
        console.log('CRON JOB: Finished sending all messages. Updating job status in database...');
        await db.collection('broadcasts').updateOne(
            { _id: job._id },
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
        
        console.log(`CRON JOB: Broadcast job ${job._id} finished with status: ${finalStatus}. Success: ${successCount}, Failed: ${errorCount}.`);
        return NextResponse.json({ message: `Job ${job._id} processed.`, status: finalStatus, success: successCount, failed: errorCount });

    } catch (error: any) {
        console.error('CRON JOB FAILED:', error);
        // If an error happens before the job is even fetched, we can't update its status.
        // This logging is our best tool for debugging such cases.
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
