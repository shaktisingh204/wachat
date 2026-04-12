
'use server';

import { NextResponse, type NextRequest, after } from 'next/server';
import crypto from 'node:crypto';
import { connectToDatabase } from "@/lib/mongodb";
import type { Db, ObjectId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { handleCallWebhook } from '@/lib/call-webhook-processor';

const LOG_PREFIX = '[META WEBHOOK]';

/**
 * Verify Meta's `x-hub-signature-256` HMAC over the raw request body.
 *
 * Meta signs every webhook payload with HMAC-SHA256 using the Facebook app
 * secret. We MUST verify this before acting on the payload, otherwise anyone
 * who discovers the public webhook URL can forge delivery/read events, fake
 * inbound messages, and trigger automations against any tenant.
 *
 * IMPORTANT: this must run against the *raw* request body (bytes as received),
 * not a re-serialized JSON object — Meta hashes the exact bytes it sent.
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
        // No secret configured — fail closed in production, fail open in dev
        // so local webhook testing (e.g. ngrok + meta simulator) still works.
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
    // timingSafeEqual requires equal-length buffers.
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
  try {
    // Read the raw body first — we need the exact bytes Meta signed to verify
    // the HMAC. Do NOT use request.json() here, because that would reparse and
    // we'd lose whitespace/ordering fidelity.
    const payloadText = await request.text();
    if (!payloadText) {
        return NextResponse.json({ status: "ignored_empty_body" }, { status: 200 });
    }

    // P0-1: verify Meta HMAC signature before doing anything else.
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

    // P0-2: run the persistence work via `after()` so Next.js guarantees it
    // completes even though we return 200 to Meta immediately. The previous
    // `fire-and-forget .then(...)` could be cancelled when the response ended,
    // silently dropping delivery updates and inbound messages.
    after(async () => {
        try {
            const { db } = await connectToDatabase();
            const projectId = await findProjectIdFromWebhook(db, payload);
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
                await handleCallWebhook(db, project as any, change.value);
            } else {
                const searchableText = getSearchableText(payload);
                await db.collection('webhook_logs').insertOne({
                    payload,
                    searchableText,
                    projectId,
                    processed: false,
                    createdAt: new Date(),
                });
            }
        } catch (err) {
            // after() callback failures are invisible to Meta by design, so we
            // must log loudly. Do NOT rethrow — that crashes the worker.
            console.error(`${LOG_PREFIX} after() webhook persistence failed:`, err);
        }
    });

    return NextResponse.json({ status: 'received' }, { status: 200 });

  } catch (error: any) {
    console.error(`${LOG_PREFIX} Fatal error in webhook ingestion:`, error);
    // Still return 200 so Meta doesn't get stuck retrying a payload we can't
    // process — but log loudly.
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
