
import { NextResponse, type NextRequest, after } from 'next/server';
import crypto from 'node:crypto';
import { connectToDatabase } from "@/lib/mongodb";
import type { Db, ObjectId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { handleCallWebhook } from '@/lib/call-webhook-processor';
import {
    handleSingleMessageEvent,
    processStatusUpdateBatch,
    processSingleWebhook,
    processCommentWebhook,
    processMessengerWebhook,
} from '@/lib/webhook-processor';
import { handlePaymentConfigurationUpdate } from '@/app/actions/whatsapp-pay.actions';

const LOG_PREFIX = '[META WEBHOOK]';

/**
 * Verify Meta's `x-hub-signature-256` HMAC over the raw request body.
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
        if (process.env.NODE_ENV === 'production') {
            console.error(`${LOG_PREFIX} FACEBOOK_APP_SECRET is not set; refusing webhook.`);
            return false;
        }
        console.warn(`${LOG_PREFIX} FACEBOOK_APP_SECRET not set — skipping signature check (dev only).`);
        return true;
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
        return false;
    }
    const expected = crypto
        .createHmac('sha256', appSecret)
        .update(rawBody, 'utf8')
        .digest('hex');
    const received = signatureHeader.slice('sha256='.length);
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(received, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    try {
        return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
        return false;
    }
}

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
                        if (value.metadata?.phone_number_id) text += ` ${value.metadata.phone_number_id}`;
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
                if (entry.changes) {
                    for (const change of entry.changes) {
                        text += ` field:${change.field} item:${change.value?.item} verb:${change.value?.verb} comment_id:${change.value?.comment_id}`;
                    }
                }
            }
        }
    } catch { /* ignore */ }
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

/**
 * Process a WhatsApp Cloud API webhook payload inline.
 * Handles: messages, statuses, template updates, account updates, payment events.
 */
async function processWebhookInline(db: Db, project: any, payload: any) {
    if (payload.object === 'whatsapp_business_account') {
        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;
                if (!value) continue;

                if (change.field === 'calls') {
                    await handleCallWebhook(db, project, value);
                    continue;
                }

                if (change.field === 'messages') {
                    // Process status updates in batch
                    if (value.statuses && value.statuses.length > 0) {
                        try {
                            await processStatusUpdateBatch(db, value.statuses);
                        } catch (e: any) {
                            console.error(`${LOG_PREFIX} Status batch error:`, e.message);
                        }
                    }

                    // Process incoming messages sequentially
                    if (value.messages && value.messages.length > 0) {
                        const phoneNumberId = value.metadata?.phone_number_id;
                        const contactProfile = value.contacts?.[0];
                        for (const message of value.messages) {
                            try {
                                await handleSingleMessageEvent(db, project, message, contactProfile, phoneNumberId);
                            } catch (e: any) {
                                console.error(`${LOG_PREFIX} Message processing error (${message.id}):`, e.message);
                            }
                        }
                    }
                } else if (change.field === 'payment_configuration_update') {
                    try {
                        await handlePaymentConfigurationUpdate(project, value);
                    } catch (e: any) {
                        console.error(`${LOG_PREFIX} Payment config update error:`, e.message);
                    }
                } else {
                    // account_update, phone_number_quality_update, template_status_update, etc.
                    try {
                        await processSingleWebhook(db, project, payload);
                    } catch (e: any) {
                        console.error(`${LOG_PREFIX} General webhook error (${change.field}):`, e.message);
                    }
                }
            }
        }
    } else if (payload.object === 'page') {
        for (const entry of payload.entry || []) {
            // Messenger messages
            if (entry.messaging) {
                for (const event of entry.messaging) {
                    try {
                        await processMessengerWebhook(db, project, event);
                    } catch (e: any) {
                        console.error(`${LOG_PREFIX} Messenger event error:`, e.message);
                    }
                }
            }
            // Feed comments
            if (entry.changes) {
                for (const change of entry.changes) {
                    if (change.field === 'feed' && change.value?.item === 'comment') {
                        try {
                            await processCommentWebhook(db, project, change.value);
                        } catch (e: any) {
                            console.error(`${LOG_PREFIX} Comment webhook error:`, e.message);
                        }
                    }
                }
            }
        }
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
    try {
        const payloadText = await request.text();
        if (!payloadText) {
            return NextResponse.json({ status: "ignored_empty_body" }, { status: 200 });
        }

        const signatureHeader = request.headers.get('x-hub-signature-256');
        if (!verifyMetaSignature(payloadText, signatureHeader)) {
            console.warn(`${LOG_PREFIX} Rejected webhook: invalid or missing signature.`);
            return NextResponse.json({ status: 'invalid_signature' }, { status: 401 });
        }

        let payload: any;
        try {
            payload = JSON.parse(payloadText);
        } catch {
            return NextResponse.json({ status: "ignored_invalid_json" }, { status: 200 });
        }

        // Process webhooks inline via after() — no cron needed.
        // after() guarantees the callback completes even after HTTP response ends.
        after(async () => {
            try {
                const { db } = await connectToDatabase();
                const projectId = await findProjectIdFromWebhook(db, payload);

                // Always log the webhook for debugging/audit
                const searchableText = getSearchableText(payload);
                await db.collection('webhook_logs').insertOne({
                    payload,
                    searchableText,
                    projectId,
                    processed: true, // Marked as processed since we handle inline
                    createdAt: new Date(),
                });

                if (!projectId) {
                    console.warn(`${LOG_PREFIX} No project found for webhook. Logged for manual review.`);
                    return;
                }

                const project = await db.collection('projects').findOne({ _id: projectId });
                if (!project) {
                    console.warn(`${LOG_PREFIX} Project ${projectId} not found.`);
                    return;
                }

                // Process the webhook immediately — no cron polling needed
                await processWebhookInline(db, project, payload);

            } catch (err) {
                console.error(`${LOG_PREFIX} Inline webhook processing failed:`, err);
            }
        });

        return NextResponse.json({ status: 'received' }, { status: 200 });

    } catch (error: any) {
        console.error(`${LOG_PREFIX} Fatal error in webhook ingestion:`, error);
        return NextResponse.json({ status: 'error' }, { status: 200 });
    }
}
