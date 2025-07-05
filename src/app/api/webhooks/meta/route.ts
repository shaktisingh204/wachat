

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { Db, Filter, ObjectId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { processSingleWebhook, processStatusUpdateBatch, processIncomingMessageBatch } from '@/lib/webhook-processor';

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
 * It now processes events instantly instead of queueing them.
 */
export async function POST(request: NextRequest) {
  let logId: ObjectId | null = null;
  try {
    const payloadText = await request.text();
    if (!payloadText) {
        return NextResponse.json({ status: "ignored_empty_body" }, { status: 200 });
    }

    const payload = JSON.parse(payloadText);
    const { db } = await connectToDatabase();

    // 1. Log the incoming event for audit and manual reprocessing
    const projectId = await findProjectIdFromWebhook(db, payload);
    const searchableText = getSearchableText(payload);
    const logResult = await db.collection('webhook_logs').insertOne({
        payload: payload,
        searchableText,
        projectId: projectId,
        processed: false, // Initially unprocessed
        createdAt: new Date(),
    });
    logId = logResult.insertedId;

    // 2. Collect all events from the payload
    const allStatuses: any[] = [];
    const allMessageEvents: { projectId: ObjectId; message: any; contactProfile: any; phoneNumberId: string }[] = [];
    const otherEvents: { projectId: ObjectId; payload: any }[] = [];

    if (payload.entry) {
        for (const entry of payload.entry) {
            const entryProjectId = await findProjectIdFromWebhook(db, { entry: [entry] });

            for (const change of entry.changes) {
                const value = change.value;
                const field = change.field;
                const phoneNumberId = value.metadata?.phone_number_id;

                if (field === 'messages' && value) {
                    if (value.statuses) {
                        allStatuses.push(...value.statuses);
                    }
                    if (value.messages && entryProjectId && phoneNumberId) {
                        for (const message of value.messages) {
                            const contactProfile = value.contacts?.find((c: any) => c.wa_id === message.from) || {};
                            allMessageEvents.push({ projectId: entryProjectId, message, contactProfile, phoneNumberId });
                        }
                    }
                } else if (field !== 'messages' && value && entryProjectId) {
                     otherEvents.push({ projectId: entryProjectId, payload: { object: payload.object, entry: [{...entry, changes: [change] }] } });
                }
            }
        }
    }
    
    let processingError: Error | null = null;
    try {
        // 3. Process batches
        const processingPromises: Promise<any>[] = [];
        if (allStatuses.length > 0) {
            processingPromises.push(processStatusUpdateBatch(db, allStatuses));
        }
        if (allMessageEvents.length > 0) {
            processingPromises.push(processIncomingMessageBatch(db, allMessageEvents));
        }

        // Other system events are less frequent and can be processed individually
        const projectsMap = new Map();
        for (const event of otherEvents) {
            let project = projectsMap.get(event.projectId.toString());
            if (!project) {
                project = await db.collection<Project>('projects').findOne({_id: event.projectId});
                if (project) projectsMap.set(project._id.toString(), project);
            }
            if (project) {
                processingPromises.push(processSingleWebhook(db, project, event.payload, logId));
            }
        }
        
        await Promise.all(processingPromises);
    } catch(e: any) {
        processingError = e;
        console.error(`Error processing webhook batch for project ${projectId}:`, e.message);
    }
    
    // 4. Mark the log as processed
    await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true, error: processingError ? processingError.message : null }});
    
    // 5. Respond to Meta immediately to acknowledge receipt.
    return NextResponse.json({ status: 'processed' }, { status: 200 });

  } catch (error: any) {
    if (error instanceof SyntaxError) {
        return NextResponse.json({ status: "ignored_invalid_json" }, { status: 200 });
    }
      
    console.error('Fatal error in webhook ingestion:', error);
    if (logId) {
        try {
            const { db } = await connectToDatabase();
            await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true, error: `Ingestion Error: ${error.message}` }});
        } catch (dbError) {
             console.error('Failed to mark log as error during ingestion failure:', dbError);
        }
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
