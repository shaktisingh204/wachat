
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
    failedSends?: { phone: string; reason: string }[];
    body: string; 
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
        let failedSends: { phone: string; reason: string }[] = [];
        const requiredVarNumbers = getRequiredVars(job.body);

        const sendPromises = job.contacts.map(async (contact) => {
            const components = [];
            if (requiredVarNumbers.length > 0) {
                const parameters = requiredVarNumbers.sort((a,b) => a - b).map(varNum => ({
                    type: 'text',
                    text: contact[`variable${varNum}`] || '',
                }));
                components.push({ type: 'body', parameters });
            }

            const messageData = {
                messaging_product: 'whatsapp',
                to: contact.phone,
                type: 'template',
                template: {
                    name: job.templateName,
                    language: { code: job.language || 'en_US' },
                    ...(components.length > 0 && { components }),
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

                if (response.ok) {
                    successCount++;
                } else {
                    let reason = 'Unknown API error';
                    try {
                        const errorData = await response.json();
                        reason = errorData?.error?.message || `API Error: ${response.status}`;
                    } catch(e) {
                        reason = `Could not parse error response from Meta. Status: ${response.status} ${response.statusText}`;
                    }
                    failedSends.push({ phone: contact.phone, reason });
                }
            } catch(e: any) {
                const reason = e.message || 'Exception during fetch';
                failedSends.push({ phone: contact.phone, reason });
            }
        });

        await Promise.all(sendPromises);

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

function getRequiredVars(body: string): number[] {
    const variableMatches = body.match(/{{(\d+)}}/g);
    return variableMatches ? [...new Set(variableMatches.map(v => parseInt(v.match(/(\d+)/)![1])))] : [];
}
