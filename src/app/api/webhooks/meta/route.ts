
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { Db, Filter, ObjectId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { 
    processSingleWebhook, 
    processIncomingMessageBatch,
    processStatusUpdateBatch,
    processCommentWebhook,
    processMessengerWebhook
} from '@/lib/webhook-processor';
import { finalizeEmbeddedSignup } from '@/app/actions/onboarding.actions';

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

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log(`${LOG_PREFIX} Webhook verified successfully!`);
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error(`${LOG_PREFIX} Webhook verification failed. Tokens do not match.`);
    return new NextResponse('Forbidden', { status: 403 });
  }
}

/**
 * Handles incoming webhook event notifications from Meta.
 * It now processes events directly for lower latency.
 */
export async function POST(request: NextRequest) {
  try {
    const payloadText = await request.text();
    if (!payloadText) {
        return NextResponse.json({ status: "ignored_empty_body" }, { status: 200 });
    }
    const payload = JSON.parse(payloadText);
    const { db } = await connectToDatabase();
    
    // Handle Embedded Signup Flow
    if (payload.object === 'whatsapp_business_account') {
        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;
                if (change.field === 'account_update' && value.event === 'EMBEDDED_SIGNUP') {
                    console.log(`${LOG_PREFIX} Received Embedded Signup webhook.`);
                    const wabaId = value.whatsapp_business_account_id;
                    const userId = change.value.business.id; // User ID from the business object
                    if (!userId) {
                        console.error(`${LOG_PREFIX} Could not find Business ID (acting as user context) in Embedded Signup webhook.`);
                        continue;
                    }
                    console.log(`${LOG_PREFIX} Initiating finalizeEmbeddedSignup for user ${userId} and WABA ${wabaId}.`);
                    await finalizeEmbeddedSignup(userId, wabaId);
                    return NextResponse.json({ success: true, message: 'Onboarding webhook processed.' });
                }
            }
        }
    }
    
    // Asynchronously log the webhook without waiting for it to complete
    findProjectIdFromWebhook(db, payload).then(projectId => {
        const searchableText = getSearchableText(payload);
        db.collection('webhook_logs').insertOne({
            payload,
            searchableText,
            projectId,
            processed: true, // Assume processed unless an error occurs below
            createdAt: new Date(),
        }).catch(err => console.error(`${LOG_PREFIX} Failed to insert webhook log:`, err));
    });

    // Main processing logic
    if (payload.object === 'whatsapp_business_account' && payload.entry) {
        for (const entry of payload.entry) {
            const projectId = await findProjectIdFromWebhook(db, { entry: [entry] });
            if (!projectId) continue;
            
            const project = await db.collection<Project>('projects').findOne({ _id: projectId });
            if (!project) continue;

            const change = entry.changes?.[0];
            if (!change) continue;
            
            const value = change.value;
            const field = change.field;

            if (field === 'messages' && value) {
                if(value.statuses) {
                    await processStatusUpdateBatch(db, value.statuses);
                }
                if(value.messages) {
                    // Although it's an array, we process one by one for flow logic
                    for (const message of value.messages) {
                        const contactProfile = value.contacts?.find((c: any) => c.wa_id === message.from) || {};
                        const phoneNumberId = value.metadata?.phone_number_id;
                        if (phoneNumberId) {
                           await handleSingleMessageEvent(db, project, message, contactProfile, phoneNumberId);
                        }
                    }
                }
            } else {
                await processSingleWebhook(db, project, { entry: [entry] });
            }
        }
    } else if (payload.object === 'page' && payload.entry) {
        for (const entry of payload.entry) {
             const projectId = await findProjectIdFromWebhook(db, { entry: [entry] });
             if (!projectId) continue;

             const project = await db.collection<Project>('projects').findOne({ _id: projectId });
             if (!project) continue;
            
            if (entry.messaging) {
                for (const event of entry.messaging) {
                    await processMessengerWebhook(db, project, event);
                }
            }
            if (entry.changes) {
                for (const change of entry.changes) {
                    if (change.field === 'feed' && change.value.item === 'comment') {
                        await processCommentWebhook(db, project, change.value);
                    }
                }
            }
        }
    }
    
    // Immediately return a success response to Meta.
    return NextResponse.json({ status: 'received' }, { status: 200 });

  } catch (error: any) {
    if (error instanceof SyntaxError) {
        return NextResponse.json({ status: "ignored_invalid_json" }, { status: 200 });
    }
    console.error(`${LOG_PREFIX} Fatal error in webhook ingestion:`, error);
    // Don't throw an error back to Meta, just log it.
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
