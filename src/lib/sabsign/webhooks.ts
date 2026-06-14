import 'server-only';

import { createHmac, randomBytes } from 'crypto';

import { connectToDatabase } from '@/lib/mongodb';

/**
 * SabSign outbound webhooks.
 *
 * Subscriptions live in `esign_webhooks` (per workspace). Lifecycle
 * transitions enqueue rows into the `esign_webhook_deliveries` outbox via
 * {@link emitWebhookEvent}; the delivery cron ({@link deliverPendingWebhooks})
 * POSTs them with an HMAC-SHA256 signature and exponential-backoff retry.
 *
 * The signature header is `X-Sabsign-Signature: sha256=<hex>` over the raw
 * request body, keyed by the subscription secret — receivers verify with
 * {@link verifyWebhookSignature}.
 */

export type SabsignWebhookEvent =
  | 'submission.created'
  | 'submission.sent'
  | 'submission.completed'
  | 'submission.declined'
  | 'submission.voided'
  | 'submission.expired'
  | 'form.completed'
  | 'form.declined'
  | 'documents.ready';

export const WEBHOOK_EVENTS: SabsignWebhookEvent[] = [
  'submission.created',
  'submission.sent',
  'submission.completed',
  'submission.declined',
  'submission.voided',
  'submission.expired',
  'form.completed',
  'form.declined',
  'documents.ready',
];

const MAX_ATTEMPTS = 6;

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

export function signWebhookBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/** Constant-time-ish verification helper for receivers. */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string | null | undefined,
): boolean {
  if (!header) return false;
  const expected = `sha256=${signWebhookBody(secret, body)}`;
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

interface WebhookSubDoc {
  _id: unknown;
  workspaceId: string;
  url: string;
  secret: string;
  events: string[] | 'all';
  active?: boolean;
}

/**
 * Enqueue a delivery for every active subscription in `workspaceId` that is
 * listening for `event`. Best-effort: failures here never block the caller.
 */
export async function emitWebhookEvent(
  workspaceId: string,
  event: SabsignWebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  if (!workspaceId) return;
  try {
    const { db } = await connectToDatabase();
    const subs = (await db
      .collection('esign_webhooks')
      .find({ workspaceId, active: { $ne: false } })
      .toArray()) as unknown as WebhookSubDoc[];

    const matching = subs.filter(
      (s) =>
        s.events === 'all' ||
        (Array.isArray(s.events) && (s.events.includes(event) || s.events.includes('*'))),
    );
    if (!matching.length) return;

    const now = new Date();
    const body = JSON.stringify({ event, ts: now.toISOString(), data });
    const rows = matching.map((s) => ({
      _id: randomBytes(12).toString('hex'),
      workspaceId,
      subscriptionId: String(s._id),
      url: s.url,
      event,
      body,
      secret: s.secret,
      status: 'pending' as const,
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    }));
    await db.collection('esign_webhook_deliveries').insertMany(rows);
  } catch (e) {
    console.warn('[sabsign] emitWebhookEvent failed:', e);
  }
}

/**
 * Deliver due outbox rows. Returns counts. Marks `delivered` on 2xx, retries
 * with exponential backoff (capped at 60 min) up to MAX_ATTEMPTS, then `failed`.
 */
export async function deliverPendingWebhooks(
  limit = 100,
): Promise<{ delivered: number; failed: number }> {
  const { db } = await connectToDatabase();
  const now = new Date();
  const pending = await db
    .collection('esign_webhook_deliveries')
    .find({ status: 'pending', nextAttemptAt: { $lte: now } })
    .limit(limit)
    .toArray();

  let delivered = 0;
  let failed = 0;
  for (const d of pending) {
    const sig = signWebhookBody(d.secret, d.body);
    try {
      const res = await fetch(d.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sabsign-Event': d.event,
          'X-Sabsign-Delivery': String(d._id),
          'X-Sabsign-Signature': `sha256=${sig}`,
        },
        body: d.body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await db
        .collection('esign_webhook_deliveries')
        .updateOne(
          { _id: d._id },
          { $set: { status: 'delivered', deliveredAt: new Date(), responseStatus: res.status } },
        );
      delivered += 1;
    } catch (e) {
      const attempts = (d.attempts ?? 0) + 1;
      const backoffMin = Math.min(60, 2 ** attempts);
      const update =
        attempts >= MAX_ATTEMPTS
          ? { status: 'failed', attempts, lastError: String(e) }
          : {
              status: 'pending',
              attempts,
              nextAttemptAt: new Date(Date.now() + backoffMin * 60_000),
              lastError: String(e),
            };
      await db.collection('esign_webhook_deliveries').updateOne({ _id: d._id }, { $set: update });
      failed += 1;
    }
  }
  return { delivered, failed };
}
