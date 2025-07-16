
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { Db, Filter, ObjectId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { processSingleWebhook, handleSingleMessageEvent, processStatusUpdateBatch, processIncomingMessageBatch, processCommentWebhook, processMessengerWebhook, processOrderWebhook, processCatalogWebhook } from '@/lib/webhook-processor';
import { revalidatePath } from 'next/cache';

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
            const phoneId = entry.changes?.[0]?.value?.metadata?.phone_number_id;
            if (phoneId) {
                const project = await db.collection<Project>('projects').findOne({ 'phoneNumbers.id': phoneId }, { projection: { _id: 1 } });
                if (project) return project._id;
            }
            
            // Fallback to WABA ID if phone number ID doesn't match (e.g., for non-message events or unsynced numbers)
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
    
    // Log first, process second
    const projectId = await findProjectIdFromWebhook(db, payload);
    const searchableText = getSearchableText(payload);
    const logResult = await db.collection('webhook_logs').insertOne({
        payload: payload, searchableText, projectId: projectId,
        processed: false, createdAt: new Date(),
    });
    logId = logResult.insertedId;
    
    let processingError: Error | null = null;

    try {
        if (!projectId) {
            throw new Error('Could not find a matching project for this webhook event.');
        }
        
        const project = await db.collection<Project>('projects').findOne({ _id: projectId });
        if (!project) {
            throw new Error(`Project with ID ${projectId} not found.`);
        }

        // --- Start Processing Logic ---
        const entry = payload.entry?.[0];
        if (!entry) {
            throw new Error('Webhook payload missing "entry" object.');
        }

        for (const change of (entry.changes || [])) {
            const field = change.field;
            const value = change.value;

            switch (field) {
                case 'messages':
                    if (value.statuses) {
                        await processStatusUpdateBatch(db, value.statuses);
                    }
                    if (value.messages) {
                        for (const message of value.messages) {
                            const contactProfile = value.contacts?.find((c: any) => c.wa_id === message.from) || {};
                            await handleSingleMessageEvent(db, project, message, contactProfile, value.metadata.phone_number_id);
                        }
                    }
                    break;
                case 'feed':
                    if (value.item === 'comment' && value.verb === 'add') {
                        await processCommentWebhook(db, project, value);
                    }
                    break;
                case 'commerce_orders':
                    await processOrderWebhook(db, project, value);
                    break;
                case 'catalog_product_events':
                    await processCatalogWebhook(db, project, value);
                    break;
                default:
                    // For other non-message events
                    await processSingleWebhook(db, project, { object: payload.object, entry: [{...entry, changes: [change] }] }, logId);
                    break;
            }
        }
        
        if (payload.object === 'page' && entry.messaging) {
            for (const messagingEvent of entry.messaging) {
                await processMessengerWebhook(db, project, messagingEvent);
            }
        }

    } catch (e: any) {
        processingError = e;
        console.error(`Error processing webhook batch for project ${projectId}:`, e.message);
    }

    await db.collection('webhook_logs').updateOne({ _id: logId }, {
      $set: {
        processed: true,
        error: processingError ? processingError.message : null,
      },
    });

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
