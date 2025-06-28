
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processSingleWebhook } from '@/lib/webhook-processor';

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
 * It processes most webhooks immediately, but queues 'messages' webhooks
 * for background processing by a cron job.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { db } = await connectToDatabase();

    // 1. Log every webhook for visibility and manual reprocessing
    const searchableText = getSearchableText(payload);
    await db.collection('webhook_logs').insertOne({
        payload: payload,
        searchableText,
        createdAt: new Date(),
    });
    
    // 2. Decide on processing strategy based on the event type
    const field = payload?.entry?.[0]?.changes?.[0]?.field;

    if (field === 'messages') {
        // For 'messages' (which includes incoming messages and status updates),
        // queue them for the background cron job to process.
        await db.collection('webhook_queue').insertOne({
            payload: payload,
            status: 'PENDING',
            createdAt: new Date(),
        });
        
        // Respond immediately to Meta to acknowledge receipt.
        return NextResponse.json({ status: 'queued' }, { status: 202 });

    } else {
        // For all other event types (template updates, account status, etc.),
        // process them immediately. We don't await this to avoid Meta timeouts.
        processSingleWebhook(db, payload).catch(err => {
            console.error(`Immediate webhook processing failed for field '${field}':`, err);
        });
        
        // Respond immediately to Meta to acknowledge receipt.
        return NextResponse.json({ status: 'processing_initiated' }, { status: 200 });
    }

  } catch (error) {
    console.error('Error in webhook ingestion:', error);
    // In case of error, return a server error but don't block Meta.
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
