
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

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
 * This endpoint only queues the webhook for processing and returns immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { db } = await connectToDatabase();

    // 1. Queue the webhook for the background processor
    await db.collection('webhook_queue').insertOne({
        payload: payload,
        status: 'PENDING',
        createdAt: new Date(),
    });

    // 2. Also write to the immediate log for visibility in the UI
    const searchableText = getSearchableText(payload);
    await db.collection('webhook_logs').insertOne({
        payload: payload,
        searchableText,
        createdAt: new Date(),
    });
    
    // We don't need to revalidate here as the cron job will handle it.

    // 3. Respond immediately to Meta
    return NextResponse.json({ status: 'queued' }, { status: 202 }); // 202 Accepted

  } catch (error) {
    console.error('Error in webhook ingestion:', error);
    // Return a server error but don't block
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
