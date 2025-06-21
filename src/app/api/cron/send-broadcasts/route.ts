
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
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { db } = await connectToDatabase();

        const job = await db.collection<BroadcastJob>('broadcasts').findOneAndUpdate(
            { status: 'QUEUED' },
            { $set: { status: 'PROCESSING', processedAt: new Date() } },
            { returnDocument: 'after', sort: { createdAt: 1 } }
        );

        if (!job) {
            return NextResponse.json({ message: 'No queued broadcasts to process.' });
        }

        console.log(`Processing broadcast job ${job._id}...`);

        let successCount = 0;
        let successfulSends: { phone: string; response: any }[] = [];
        let failedSends: { phone: string; response: any }[] = [];
        
        const CHUNK_SIZE = 80;
        const DELAY_MS = 1000; // 1 second delay between chunks

        for (let i = 0; i < job.contacts.length; i += CHUNK_SIZE) {
            const chunk = job.contacts.slice(i, i + CHUNK_SIZE);
            
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
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }


        const errorCount = failedSends.length;
        let finalStatus: 'Completed' | 'Partial Failure' | 'Failed' = 'Completed';
        if (errorCount > 0) {
          finalStatus = successCount > 0 ? 'Partial Failure' : 'Failed';
        }

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
        
        console.log(`Broadcast job ${job._id} finished with status: ${finalStatus}.`);
        return NextResponse.json({ message: `Job ${job._id} processed.`, status: finalStatus, success: successCount, failed: errorCount });

    } catch (error: any) {
        console.error('Cron job failed:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
