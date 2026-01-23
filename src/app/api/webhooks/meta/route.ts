
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from "@/lib/mongodb";
import type { Db, ObjectId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { handleCallWebhook } from '@/lib/call-webhook-processor';

const LOG_PREFIX = '[META WEBHOOK]';

const getSearchableText = (payload: any): string => {
    let text = '';
    try {
        if (payload.object === 'whatsapp_business_account' && payload.entry) {
            for (const entry of payload.entry) {
                text += ` ${entry.id}`;
                if (entry.changes) {
                    for (const change of entry.changes) {
                        const field = change.field;
                        text += ` ${field}`;
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log(`${LOG_PREFIX} Webhook verified successfully!`);
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error(`${LOG_PREFIX} Webhook verification failed.`);
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const { db } = await connectToDatabase();

  try {
    const payloadText = await request.text();
    if (!payloadText) {
        return NextResponse.json({ status: "ignored_empty_body" }, { status: 200 });
    }
    const payload = JSON.parse(payloadText);
    
    // Asynchronously log the webhook without waiting for it to complete
    findProjectIdFromWebhook(db, payload).then(async (projectId) => {
        if (!projectId) {
            console.warn(`${LOG_PREFIX} Could not find project for webhook payload.`);
            return;
        }

        const project = await db.collection('projects').findOne({ _id: projectId });
        if (!project) {
            console.warn(`${LOG_PREFIX} Project ${projectId} not found for webhook processing.`);
            return;
        }

        const change = payload.entry?.[0]?.changes?.[0];
        if (change?.field === 'calls') {
            // Route to the dedicated call processor
            await handleCallWebhook(db, project, change.value);
        } else {
            // Existing logic to queue other webhooks
            const searchableText = getSearchableText(payload);
            db.collection('webhook_logs').insertOne({
                payload,
                searchableText,
                projectId,
                processed: false,
                createdAt: new Date(),
            }).catch(err => console.error(`${LOG_PREFIX} Failed to insert webhook log:`, err));
        }
    });
    
    return NextResponse.json({ status: 'received' }, { status: 200 });

  } catch (error: any) {
    if (error instanceof SyntaxError) {
        return NextResponse.json({ status: "ignored_invalid_json" }, { status: 200 });
    }
    console.error(`${LOG_PREFIX} Fatal error in webhook ingestion:`, error);
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
