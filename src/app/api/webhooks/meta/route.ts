
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { Db, Filter, ObjectId } from 'mongodb';
import type { Project } from '@/app/actions';

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

async function findProjectIdFromWebhook(db: Db, payload: any): Promise<ObjectId | null> {
    try {
        const entry = payload?.entry?.[0];
        if (!entry) return null;

        const wabaId = entry.id;
        const phoneId = entry.changes?.[0]?.value?.metadata?.phone_number_id;

        const query: Filter<Project> = {};
        if (phoneId) {
            query['phoneNumbers.id'] = phoneId;
        } else if (wabaId && wabaId !== '0') {
            query.wabaId = wabaId;
        } else {
            return null;
        }

        const project = await db.collection('projects').findOne(query, { projection: { _id: 1 } });
        return project?._id || null;

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
 * It queues all events for reliable background processing by a cron job.
 */
export async function POST(request: NextRequest) {
  let logId: ObjectId | null = null;
  try {
    const payloadText = await request.text();
    if (!payloadText) {
        console.log("Webhook received an empty POST request. This is likely a test or verification. Ignoring.");
        return NextResponse.json({ status: "ignored_empty_body" }, { status: 200 });
    }

    const payload = JSON.parse(payloadText);
    const { db } = await connectToDatabase();

    // 1. Enrich payload with Project ID for efficient parallel processing
    const projectId = await findProjectIdFromWebhook(db, payload);
    const searchableText = getSearchableText(payload);

    // 2. Log every webhook for visibility and manual reprocessing
    const logResult = await db.collection('webhook_logs').insertOne({
        payload: payload,
        searchableText,
        projectId: projectId,
        processed: false, // Initially, all logs are unprocessed
        createdAt: new Date(),
    });
    logId = logResult.insertedId;
    
    // 3. Always queue the event for the cron job to process reliably.
    await db.collection('webhook_queue').insertOne({
        payload: payload,
        logId: logId,
        projectId: projectId,
        status: 'PENDING',
        createdAt: new Date(),
    });
    
    // 4. Respond to Meta immediately to acknowledge receipt.
    // Use 200 OK as per Meta's recommendation for reliability.
    return NextResponse.json({ status: 'queued' }, { status: 200 });

  } catch (error: any) {
    if (error instanceof SyntaxError) {
        console.warn("Webhook ingestion failed due to invalid JSON. This might be a verification request or an empty POST. Ignoring.");
        // Acknowledge the request to prevent Meta from retrying a bad request.
        return NextResponse.json({ status: "ignored_invalid_json" }, { status: 200 });
    }
      
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
