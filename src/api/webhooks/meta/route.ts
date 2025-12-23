
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { Db, Filter, ObjectId } from 'mongodb';
import type { Project, WebhookLog } from '@/lib/definitions';

const LOG_PREFIX = '[META WEBHOOK]';

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
        } else if (payload.object === 'page' && payload.entry) {
            for (const entry of payload.entry) {
                text += ` page_id:${entry.id}`;
                if (entry.messaging) {
                    for (const message of entry.messaging) {
                        text += ` sender:${message.sender?.id || ''} recipient:${message.recipient?.id || ''} mid:${message.message?.mid || ''}`;
                    }
                }
                if(entry.changes) {
                    for (const change of entry.changes) {
                         text += ` field:${change.field} item:${change.value?.item} verb:${change.value?.verb} comment_id:${change.value?.comment_id}`;
                    }
                }
            }
        }
    } catch(e) { /* ignore errors during text creation */ }
    return text.replace(/\s+/g, ' ').trim();
};

async function findProjectIdFromWebhook(db: Db, payload: any): Promise<ObjectId | null> {
    try {
        const entry = payload?.entry?.[0];
        if (!entry) return null;

        if (payload.object === 'whatsapp_business_account') {
            // Find by phone number ID first, it's the most specific
            const phoneId = entry.changes?.[0]?.value?.metadata?.phone_number_id;
            if (phoneId) {
                const project = await db.collection<Project>('projects').findOne({ 'phoneNumbers.id': phoneId }, { projection: { _id: 1 } });
                if (project) return project._id;
            }
            
            // Fallback to WABA ID
            const wabaId = entry.id;
            if (wabaId && wabaId !== '0') {
                const project = await db.collection<Project>('projects').findOne({ wabaId: wabaId }, { projection: { _id: 1 } });
                if (project) return project._id;
            }
        } else if (payload.object === 'page') {
            const pageId = entry.id;
            if (pageId) {
                const project = await db.collection<Project>('projects').findOne({ facebookPageId: pageId }, { projection: { _id: 1 } });
                if (project) return project._id;
            }
        }

        return null;

    } catch (e) {
        console.error("Error finding project ID from webhook", e);
        return null;
    }
}


/**
 * Handles webhook verification requests from Meta.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verify the token from environment variables
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log(`${LOG_PREFIX} Webhook verified successfully!`);
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error(`${LOG_PREFIX} Webhook verification failed. Provided token: ${token} | Expected token: ${process.env.META_VERIFY_TOKEN}`);
    return new NextResponse('Forbidden', { status: 403 });
  }
}

/**
 * Handles incoming webhook event notifications from Meta.
 * It now ONLY logs the event to the database for later processing by a cron job.
 */
export async function POST(request: NextRequest) {
  const { db } = await connectToDatabase();

  try {
    const payloadText = await request.text();
    if (!payloadText) {
        return NextResponse.json({ status: "ignored_empty_body" }, { status: 200 });
    }
    const payload = JSON.parse(payloadText);
    
    // Asynchronously log the webhook without waiting for it to complete.
    // This is the sole responsibility of this endpoint now.
    findProjectIdFromWebhook(db, payload).then(projectId => {
        const searchableText = getSearchableText(payload);
        db.collection<WebhookLog>('webhook_logs').insertOne({
            payload,
            searchableText,
            projectId,
            processed: false, // <-- Always default to false.
            createdAt: new Date(),
        }).catch(err => console.error(`${LOG_PREFIX} Failed to insert webhook log:`, err));
    });

    // Immediately return a success response to Meta.
    return NextResponse.json({ status: 'received_and_queued' }, { status: 200 });

  } catch (error: any) {
    if (error instanceof SyntaxError) {
        // This is a bad request from Meta, no need to log, just acknowledge.
        return NextResponse.json({ status: "ignored_invalid_json" }, { status: 200 });
    }
    // Log any other unexpected errors during payload parsing or initial handling.
    console.error(`${LOG_PREFIX} Fatal error in webhook ingestion:`, error);
    // Return a 200 to Meta to prevent it from resending, but our logs will show the error.
    return NextResponse.json({ status: 'error_before_queuing' }, { status: 200 });
  }
}
