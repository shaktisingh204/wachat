
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

/* ── In-memory project cache ────────────────────────────────────────
 * Avoids a MongoDB findOne per webhook. Cache lives for 60s then
 * refreshes lazily. At 1000 webhooks/sec this saves ~1000 queries/sec.
 * ─────────────────────────────────────────────────────────────────── */

type CachedProject = { project: any; expiresAt: number };
const projectCache = new Map<string, CachedProject>();
const PROJECT_CACHE_TTL = 60_000; // 60 seconds

/** Invalidate a cached project so the next webhook picks up fresh data. */
export function invalidateProjectCache(projectId: string) {
    projectCache.delete(projectId);
}

async function getCachedProject(db: Db, projectId: ObjectId): Promise<any | null> {
    const key = projectId.toString();
    const cached = projectCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.project;

    const project = await db.collection('projects').findOne(
        { _id: projectId },
        { projection: { _id: 1, wabaId: 1, accessToken: 1, phoneNumbers: 1, autoReplySettings: 1, optInOutSettings: 1, facebookPageId: 1, userId: 1, name: 1, connectedCatalogId: 1 } }
    );
    if (project) {
        projectCache.set(key, { project, expiresAt: Date.now() + PROJECT_CACHE_TTL });
    }
    return project;
}

/* ── Phone→Project index cache ──────────────────────────────────── */

const phoneToProjectId = new Map<string, { id: ObjectId; expiresAt: number }>();
const wabaToProjectId = new Map<string, { id: ObjectId; expiresAt: number }>();
const pageToProjectId = new Map<string, { id: ObjectId; expiresAt: number }>();
const INDEX_TTL = 120_000; // 2 minutes

async function resolveProjectId(db: Db, payload: any): Promise<ObjectId | null> {
    try {
        const entry = payload?.entry?.[0];
        if (!entry) return null;

        if (payload.object === 'whatsapp_business_account') {
            // Try phone number ID first (most common path)
            const phoneId = entry.changes?.[0]?.value?.metadata?.phone_number_id;
            if (phoneId) {
                const cached = phoneToProjectId.get(phoneId);
                if (cached && cached.expiresAt > Date.now()) return cached.id;

                const project = await db.collection<Project>('projects').findOne(
                    { 'phoneNumbers.id': phoneId },
                    { projection: { _id: 1 } }
                );
                if (project) {
                    phoneToProjectId.set(phoneId, { id: project._id, expiresAt: Date.now() + INDEX_TTL });
                    return project._id;
                }
            }

            // Fallback to WABA ID
            const wabaId = entry.id;
            if (wabaId && wabaId !== '0') {
                const cached = wabaToProjectId.get(wabaId);
                if (cached && cached.expiresAt > Date.now()) return cached.id;

                const project = await db.collection<Project>('projects').findOne(
                    { wabaId },
                    { projection: { _id: 1 } }
                );
                if (project) {
                    wabaToProjectId.set(wabaId, { id: project._id, expiresAt: Date.now() + INDEX_TTL });
                    return project._id;
                }
            }
        } else if (payload.object === 'page') {
            const pageId = entry.id;
            if (pageId) {
                const cached = pageToProjectId.get(pageId);
                if (cached && cached.expiresAt > Date.now()) return cached.id;

                const project = await db.collection<Project>('projects').findOne(
                    { facebookPageId: pageId },
                    { projection: { _id: 1 } }
                );
                if (project) {
                    pageToProjectId.set(pageId, { id: project._id, expiresAt: Date.now() + INDEX_TTL });
                    return project._id;
                }
            }
        }
        return null;
    } catch {
        return null;
    }
}

/* ── Signature verification ─────────────────────────────────────── */

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
        if (process.env.NODE_ENV === 'production') return false;
        return true;
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
    const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
    const received = signatureHeader.slice(7);
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(received, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    try { return crypto.timingSafeEqual(expectedBuf, receivedBuf); } catch { return false; }
}

/* ── Inline processor ───────────────────────────────────────────── */

async function processWebhookInline(db: Db, project: any, payload: any) {
    if (payload.object === 'whatsapp_business_account') {
        // Collect all statuses and messages across entries for batch processing
        const allStatuses: any[] = [];
        const allMessages: { message: any; contactProfile: any; phoneNumberId: string }[] = [];
        const otherChanges: { field: string; value: any }[] = [];

        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;
                if (!value) continue;

                if (change.field === 'calls') {
                    // Calls are rare — process inline
                    handleCallWebhook(db, project, value).catch(e =>
                        console.error(`${LOG_PREFIX} Call error:`, e.message));
                    continue;
                }

                if (change.field === 'messages') {
                    if (value.statuses) allStatuses.push(...value.statuses);
                    if (value.messages) {
                        const phoneNumberId = value.metadata?.phone_number_id;
                        const contactProfile = value.contacts?.[0];
                        for (const msg of value.messages) {
                            allMessages.push({ message: msg, contactProfile, phoneNumberId });
                        }
                    }
                } else if (change.field === 'payment_configuration_update') {
                    handlePaymentConfigurationUpdate(project, value).catch(e =>
                        console.error(`${LOG_PREFIX} Payment error:`, e.message));
                } else {
                    otherChanges.push({ field: change.field, value });
                }
            }
        }

        // Process statuses in one batch (fire-and-forget — no await needed)
        if (allStatuses.length > 0) {
            processStatusUpdateBatch(db, allStatuses).catch(e =>
                console.error(`${LOG_PREFIX} Status batch error:`, e.message));
        }

        // Process other changes (template updates, account updates, etc.)
        if (otherChanges.length > 0) {
            processSingleWebhook(db, project, payload).catch(e =>
                console.error(`${LOG_PREFIX} Other change error:`, e.message));
        }

        // Process incoming messages — sequential per message to avoid contact race conditions
        // but don't block statuses from processing
        for (const { message, contactProfile, phoneNumberId } of allMessages) {
            try {
                await handleSingleMessageEvent(db, project, message, contactProfile, phoneNumberId);
            } catch (e: any) {
                console.error(`${LOG_PREFIX} Message error (${message.id}):`, e.message);
            }
        }

    } else if (payload.object === 'page') {
        const promises: Promise<any>[] = [];
        for (const entry of payload.entry || []) {
            if (entry.messaging) {
                for (const event of entry.messaging) {
                    promises.push(processMessengerWebhook(db, project, event).catch(e =>
                        console.error(`${LOG_PREFIX} Messenger error:`, e.message)));
                }
            }
            if (entry.changes) {
                for (const change of entry.changes) {
                    if (change.field === 'feed' && change.value?.item === 'comment') {
                        promises.push(processCommentWebhook(db, project, change.value).catch(e =>
                            console.error(`${LOG_PREFIX} Comment error:`, e.message)));
                    }
                }
            }
        }
        if (promises.length > 0) await Promise.allSettled(promises);
    }
}

/* ── Route handlers ─────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
    try {
        const payloadText = await request.text();
        if (!payloadText) {
            return NextResponse.json({ status: "ok" }, { status: 200 });
        }

        const signatureHeader = request.headers.get('x-hub-signature-256');
        if (!verifyMetaSignature(payloadText, signatureHeader)) {
            return NextResponse.json({ status: 'invalid_signature' }, { status: 401 });
        }

        let payload: any;
        try { payload = JSON.parse(payloadText); } catch {
            return NextResponse.json({ status: "ok" }, { status: 200 });
        }

        // Determine if this is just a status update (most common, highest volume)
        const isStatusOnly = payload.object === 'whatsapp_business_account'
            && payload.entry?.length === 1
            && payload.entry[0].changes?.length === 1
            && payload.entry[0].changes[0].field === 'messages'
            && payload.entry[0].changes[0].value?.statuses
            && !payload.entry[0].changes[0].value?.messages;

        after(async () => {
            try {
                const { db } = await connectToDatabase();
                const projectId = await resolveProjectId(db, payload);

                if (!projectId) {
                    // Only log unresolvable webhooks (rare)
                    await db.collection('webhook_logs').insertOne({
                        payload, projectId: null, processed: false,
                        error: 'No project found', createdAt: new Date(),
                    });
                    return;
                }

                const project = await getCachedProject(db, projectId);
                if (!project) return;

                // Skip logging for status-only webhooks (90%+ of volume)
                // They don't need audit trails — the status is on the message doc
                if (!isStatusOnly) {
                    db.collection('webhook_logs').insertOne({
                        payload, projectId, processed: true, createdAt: new Date(),
                    }).catch(() => {}); // fire-and-forget, don't block processing
                }

                await processWebhookInline(db, project, payload);

            } catch (err) {
                console.error(`${LOG_PREFIX} Processing failed:`, err);
            }
        });

        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch {
        return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
}
