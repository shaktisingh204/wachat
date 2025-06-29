
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processSingleWebhook } from '@/lib/webhook-processor';
import type { ObjectId } from 'mongodb';

const getSearchableText = (payload: any): string => {
    let text = '';
    try {
        if (payload.object === 'whatsapp_business_account' && payload.entry) {
            for (const entry of payload.entry) {
                text += ` ${entry.id}`; // WABA ID or 0
                if (entry.changes) {
                    for (const change of entry.changes) {
                        const field = change.field;
                        text += ` ${field}`; // The type of change
                        const value = change.value;
                        if (!value) continue;

                        if (value.metadata?.phone_number_id) {
                            text += ` ${value.metadata.phone_number_id}`;
                        }

                        if (value.messages) {
                            for (const message of value.messages) {
                                text += ` ${message.from || ''} ${message.id || ''} ${message.type || ''}`;
                            }
                        }
                        if (value.statuses) {
                            for (const status of value.statuses) {
                                text += ` ${status.id || ''} ${status.recipient_id || ''} ${status.status || ''}`;
                            }
                        }
                    }
                }
            }
        }
    } catch(e) { /* ignore errors during text creation */ }
    return text.replace(/\s+/g, ' ').trim();
};

/**
 * Handles webhook verification requests from Meta.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log("Webhook verified successfully!");
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error("Webhook verification failed. Tokens do not match.");
    return new NextResponse('Forbidden', { status: 403 });
  }
}

/**
 * Handles incoming webhook event notifications from Meta.
 * It queues high-volume message events for batch processing and
 * handles low-volume events immediately.
 */
export async function POST(request: NextRequest) {
  let logId: ObjectId | null = null;
  try {
    const payload = await request.json();
    const { db } = await connectToDatabase();

    // 1. Log every webhook for visibility and manual reprocessing
    const searchableText = getSearchableText(payload);
    const logResult = await db.collection('webhook_logs').insertOne({
        payload: payload,
        searchableText,
        processed: false, // Initially, all logs are unprocessed
        createdAt: new Date(),
    });
    logId = logResult.insertedId;
    
    // 2. Decide on processing strategy based on the event type
    const change = payload?.entry?.[0]?.changes?.[0];
    const field = change?.field;

    // For high-volume 'messages' events (incoming & statuses), always queue them.
    if (field === 'messages') {
        await db.collection('webhook_queue').insertOne({
            payload: payload,
            logId: logId, // Pass the logId to the queue item
            status: 'PENDING',
            createdAt: new Date(),
        });
        
        // Respond to Meta to acknowledge receipt. Use 202 Accepted as we're processing async.
        return NextResponse.json({ status: 'queued' }, { status: 202 });

    } else {
        // For all other low-volume event types (template updates, account status, etc.),
        // process them immediately. This is safe and provides faster feedback.
        processSingleWebhook(db, payload, logId).catch(err => {
            console.error(`Immediate webhook processing failed for field '${field}':`, err);
        });
        
        // Respond immediately to Meta to acknowledge receipt.
        return NextResponse.json({ status: 'processing_initiated' }, { status: 200 });
    }

  } catch (error: any) {
    console.error('Error in webhook ingestion:', error);
    // If an error occurs during ingestion and we have a log ID, mark the log as failed.
    if (logId) {
        try {
            const { db } = await connectToDatabase();
            await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true, error: `Ingestion Error: ${error.message}` }});
        } catch (dbError) {
             console.error('Failed to mark log as error during ingestion failure:', dbError);
        }
    }
    // In case of error, return a server error but don't block Meta.
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
