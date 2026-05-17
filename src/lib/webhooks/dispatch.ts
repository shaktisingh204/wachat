/**
 * CRM Webhook subscriptions — fan-out dispatcher (Phase 7 foundation).
 *
 * Collections:
 *   • `crm_webhook_subscriptions` — registered targets per tenant.
 *   • `crm_webhook_deliveries`    — per-attempt outcome ledger.
 *
 * Outbound contract:
 *   POST <subscription.targetUrl>
 *   Headers:
 *     content-type:       application/json
 *     user-agent:         SabNode-CRM-Webhooks/1.0
 *     x-sabnode-event:    <eventName>           e.g. account.created
 *     x-sabnode-signature: sha256=<hex>         HMAC-SHA-256(secret, body)
 *     x-sabnode-delivery: <uuid>
 *   Body: JSON `{ event, tenantUserId, deliveryId, occurredAt, data }`.
 *
 * Delivery policy:
 *   • Up to 3 attempts (1 initial + 2 retries).
 *   • Exponential backoff: 500ms, 2s, 8s (capped at 30s).
 *   • Retryable on transport errors, 408, 429, 5xx.
 *   • On terminal failure we bump `failureCount` on the subscription.
 *     When `failureCount` crosses 10 (consecutive) the subscription is
 *     auto-paused (`status = 'paused'`).
 *   • Successful delivery resets `failureCount` to 0 and stamps `lastDeliveryAt`.
 *
 * Webhook secrets are stored encrypted using the same `INDIA_TAX_ENCRYPTION_KEY`
 * env pattern as `src/lib/india-tax/credentials.ts` (32-byte hex/base64).
 * In dev — with no key set — the secret is stored unencrypted in a clearly
 * labelled envelope so local testing still works.
 */

import 'server-only';

import crypto, { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ObjectId, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

/* ── Types ──────────────────────────────────────────────────────────────── */

/** Status of a registered webhook subscription. */
export type CrmWebhookStatus = 'active' | 'paused';

/** Encrypted secret envelope (same shape as india-tax). */
export interface WebhookSecretEnvelope {
    alg: 'aes-256-gcm' | 'unencrypted';
    iv: string;
    tag: string;
    ct: string;
}

/** Stored subscription document. */
export interface CrmWebhookSubscriptionDoc {
    _id?: ObjectId;
    tenantUserId: string;
    name: string;
    targetUrl: string;
    events: string[];
    secret: WebhookSecretEnvelope;
    status: CrmWebhookStatus;
    createdAt: string;
    updatedAt?: string;
    lastDeliveryAt?: string;
    /** Consecutive failures — auto-paused once it reaches 10. */
    failureCount: number;
}

/** Stored delivery attempt log row. */
export interface CrmWebhookDeliveryDoc {
    _id?: ObjectId;
    subscriptionId: ObjectId;
    tenantUserId: string;
    event: string;
    payload: unknown;
    deliveryId: string;
    attempts: number;
    responseStatus: number | null;
    responseBody?: string;
    success: boolean;
    error?: string;
    startedAt: string;
    finishedAt: string;
}

/* ── Secret encryption (mirrors india-tax/credentials.ts) ──────────────── */

let warnedNoKey = false;

function loadKey(): Buffer | null {
    const raw = process.env.INDIA_TAX_ENCRYPTION_KEY;
    if (!raw) {
        if (!warnedNoKey) {
            console.warn(
                '[crm-webhooks] INDIA_TAX_ENCRYPTION_KEY not set — webhook secrets will be stored unencrypted. ' +
                    'Set a 32-byte hex/base64 key before production use.',
            );
            warnedNoKey = true;
        }
        return null;
    }
    let buf: Buffer;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        buf = Buffer.from(raw, 'hex');
    } else {
        buf = Buffer.from(raw, 'base64');
    }
    if (buf.length !== 32) {
        throw new Error(
            `INDIA_TAX_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}).`,
        );
    }
    return buf;
}

export function encryptWebhookSecret(plaintext: string): WebhookSecretEnvelope {
    if (typeof plaintext !== 'string') plaintext = String(plaintext ?? '');
    const key = loadKey();
    if (!key) {
        return {
            alg: 'unencrypted',
            iv: '',
            tag: '',
            ct: Buffer.from(plaintext, 'utf8').toString('base64'),
        };
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        alg: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ct: ct.toString('base64'),
    };
}

export function decryptWebhookSecret(
    env: WebhookSecretEnvelope | null | undefined,
): string | null {
    if (!env || typeof env !== 'object') return null;
    if (env.alg === 'unencrypted') {
        try {
            return Buffer.from(env.ct, 'base64').toString('utf8');
        } catch {
            return null;
        }
    }
    const key = loadKey();
    if (!key) return null;
    try {
        const iv = Buffer.from(env.iv, 'base64');
        const tag = Buffer.from(env.tag, 'base64');
        const ct = Buffer.from(env.ct, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
        return pt.toString('utf8');
    } catch (e) {
        console.error('[crm-webhooks] decrypt failed:', e);
        return null;
    }
}

/** Generate a fresh shared secret (32 random bytes, base64url-encoded). */
export function generateWebhookSecret(): string {
    return randomBytes(32).toString('base64url');
}

/* ── Signing ────────────────────────────────────────────────────────────── */

/** Produce `sha256=<hex>` HMAC over the serialised body. */
export function signWebhookPayload(secret: string, body: string): string {
    const digest = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    return `sha256=${digest}`;
}

/* ── Delivery loop ──────────────────────────────────────────────────────── */

const DELIVERY = {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 30_000,
    timeoutMs: 10_000,
    autoPauseAt: 10,
} as const;

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(status: number): boolean {
    if (status === 408 || status === 429) return true;
    return status >= 500 && status < 600;
}

async function attemptOnce(
    url: string,
    body: string,
    signature: string,
    event: string,
    deliveryId: string,
): Promise<{ status: number; body: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY.timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'SabNode-CRM-Webhooks/1.0',
                'x-sabnode-event': event,
                'x-sabnode-signature': signature,
                'x-sabnode-delivery': deliveryId,
            },
            body,
            signal: controller.signal,
        });
        const text = await res.text().catch(() => '');
        return { status: res.status, body: text.slice(0, 4096) };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Dispatch `eventName` to every active subscription matching it for
 * `tenantUserId`. Resolves once all deliveries have finished (success or
 * terminal failure) so callers can `void` it to fire-and-forget.
 *
 * NEVER throws — all errors are swallowed and logged. Wrap with try/catch
 * at the call site too, defensively.
 */
export async function dispatchWebhookEvent(
    tenantUserId: string,
    eventName: string,
    payload: unknown,
): Promise<void> {
    if (!tenantUserId || !eventName) return;

    let subs: CrmWebhookSubscriptionDoc[] = [];
    let deliveryColl: ReturnType<Awaited<ReturnType<typeof connectToDatabase>>['db']['collection']> | null = null;
    let subColl: ReturnType<Awaited<ReturnType<typeof connectToDatabase>>['db']['collection']> | null = null;
    try {
        const { db } = await connectToDatabase();
        subColl = db.collection('crm_webhook_subscriptions');
        deliveryColl = db.collection('crm_webhook_deliveries');
        subs = (await subColl
            .find({
                tenantUserId,
                status: 'active',
                events: eventName,
            })
            .toArray()) as unknown as CrmWebhookSubscriptionDoc[];
    } catch (e) {
        console.error('[crm-webhooks] lookup failed:', e);
        return;
    }

    if (subs.length === 0) return;

    const occurredAt = new Date().toISOString();

    await Promise.all(
        subs.map((sub) =>
            deliverOne(
                sub,
                eventName,
                payload,
                occurredAt,
                subColl!,
                deliveryColl!,
            ).catch((e) => {
                console.error('[crm-webhooks] deliverOne failed:', e);
            }),
        ),
    );
}

async function deliverOne(
    sub: CrmWebhookSubscriptionDoc,
    eventName: string,
    payload: unknown,
    occurredAt: string,
    subColl: NonNullable<Parameters<typeof Object.assign>[0]> & {
        updateOne: (filter: Document, update: Document) => Promise<unknown>;
    },
    deliveryColl: {
        insertOne: (doc: Document) => Promise<unknown>;
    },
): Promise<void> {
    const secret = decryptWebhookSecret(sub.secret);
    if (!secret) {
        console.error('[crm-webhooks] missing/undecryptable secret for', sub._id);
        return;
    }

    const deliveryId = randomUUID();
    const envelope = {
        event: eventName,
        tenantUserId: sub.tenantUserId,
        deliveryId,
        occurredAt,
        data: payload,
    };
    const body = JSON.stringify(envelope);
    const signature = signWebhookPayload(secret, body);

    const startedAt = new Date().toISOString();
    let attempts = 0;
    let lastStatus: number | null = null;
    let lastBody: string | undefined;
    let lastError: string | undefined;
    let success = false;

    for (let i = 1; i <= DELIVERY.maxAttempts; i++) {
        attempts = i;
        try {
            const { status, body: respBody } = await attemptOnce(
                sub.targetUrl,
                body,
                signature,
                eventName,
                deliveryId,
            );
            lastStatus = status;
            lastBody = respBody;
            lastError = undefined;
            if (status >= 200 && status < 300) {
                success = true;
                break;
            }
            if (!isRetryable(status) || i === DELIVERY.maxAttempts) break;
        } catch (err) {
            lastStatus = null;
            lastError = err instanceof Error ? err.message : String(err);
            if (i === DELIVERY.maxAttempts) break;
        }
        await sleep(Math.min(DELIVERY.baseDelayMs * 4 ** (i - 1), DELIVERY.maxDelayMs));
    }

    const finishedAt = new Date().toISOString();

    // Persist delivery row (best-effort).
    void deliveryColl
        .insertOne({
            subscriptionId: sub._id!,
            tenantUserId: sub.tenantUserId,
            event: eventName,
            payload: envelope,
            deliveryId,
            attempts,
            responseStatus: lastStatus,
            responseBody: lastBody,
            success,
            error: lastError,
            startedAt,
            finishedAt,
        } as CrmWebhookDeliveryDoc)
        .catch(() => undefined);

    // Update subscription bookkeeping.
    if (success) {
        await subColl
            .updateOne(
                { _id: sub._id! } as Document,
                {
                    $set: {
                        lastDeliveryAt: finishedAt,
                        failureCount: 0,
                    },
                },
            )
            .catch(() => undefined);
    } else {
        const newFailureCount = (sub.failureCount ?? 0) + 1;
        const shouldPause = newFailureCount >= DELIVERY.autoPauseAt;
        await subColl
            .updateOne(
                { _id: sub._id! } as Document,
                {
                    $set: {
                        failureCount: newFailureCount,
                        ...(shouldPause ? { status: 'paused' as CrmWebhookStatus } : {}),
                        lastDeliveryAt: finishedAt,
                    },
                },
            )
            .catch(() => undefined);
        if (shouldPause) {
            console.warn(
                `[crm-webhooks] auto-paused subscription ${String(sub._id)} after ${newFailureCount} consecutive failures.`,
            );
        }
    }
}

/** All webhook events emitted by the CRM. Add as we wire emitters. */
export const CRM_WEBHOOK_EVENTS = [
    'account.created',
    'account.updated',
    'account.deleted',
    'contact.created',
    'contact.updated',
    'contact.deleted',
    'lead.created',
    'lead.updated',
    'lead.deleted',
    'deal.created',
    'deal.updated',
    'deal.deleted',
    'quotation.created',
    'quotation.updated',
    'quotation.deleted',
    'invoice.created',
    'invoice.updated',
    'invoice.deleted',
    'sales-order.created',
    'sales-order.updated',
    'sales-order.deleted',
    'task.created',
    'task.updated',
    'task.deleted',
    'item.created',
    'item.updated',
    'item.deleted',
    'vendor.created',
    'vendor.updated',
    'vendor.deleted',
] as const;

export type CrmWebhookEvent = (typeof CRM_WEBHOOK_EVENTS)[number];
