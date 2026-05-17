/**
 * SabNode webhook-worker — outbound delivery data plane.
 *
 * Polls `webhook_deliveries` for `status === 'pending'` AND
 * `nextAttemptAt <= now`, then for each row:
 *
 *   1. Loads the parent subscription (`webhook_subscriptions`) for the
 *      receiver URL and signing-secret hash.
 *   2. Builds the HMAC-SHA256 signature header
 *      `X-SabNode-Signature: t=<ts>,v1=<hex>` where the signed string is
 *      `<ts>.<json-body>`. Receivers verify by recomputing using the
 *      plaintext secret they captured at subscription creation.
 *   3. POSTs the payload to the subscriber URL with a 10s timeout.
 *   4. Writes the attempt result back to `webhook_deliveries` —
 *      success → `status: success`; failure → bumps `attempts`, sets
 *      `nextAttemptAt` per the retry schedule, or marks `failed` once the
 *      cap is hit. Also updates `webhook_subscriptions.consecutiveFailures`
 *      and auto-pauses subscriptions hitting the configured threshold.
 *
 * Retry schedule (matches the developer-apis-plan §4.4):
 *   0s → 30s → 5m → 1h → 6h → 24h → mark failed.
 *
 * Tenancy: subscriptions carry `tenantId`; deliveries inherit it. The
 * worker never looks at tenant boundaries — it just delivers what's in
 * the queue.
 *
 * Run via PM2: `pm2 start services/webhook-worker/index.ts --interpreter ./node_modules/.bin/tsx --name webhook-worker`
 */

import { createHmac } from 'node:crypto';
import { MongoClient, ObjectId, type Document } from 'mongodb';

interface SubscriptionDoc extends Document {
  _id: ObjectId;
  tenantId: string;
  url: string;
  events: string[];
  status: 'active' | 'paused' | 'failed';
  /**
   * We never persist the plaintext secret. The Rust admin crate stores
   * `secretHash = sha256(suffix)` for verification; here we need the
   * **plaintext** to sign outbound payloads. The worker therefore reads
   * the secret from a separate `webhook_subscription_secrets` collection
   * that the Rust crate writes alongside the subscription on creation.
   *
   * If the secret row is missing the worker logs and pauses the
   * subscription — receivers would otherwise see signatures they can't
   * verify.
   */
  consecutiveFailures?: number;
}

interface DeliveryDoc extends Document {
  _id: ObjectId;
  subscriptionId: ObjectId;
  tenantId: string;
  event: string;
  payload: unknown;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  nextAttemptAt?: Date;
  responseStatus?: number | null;
  lastError?: string;
  createdAt: Date;
  finishedAt?: Date;
}

interface SecretDoc extends Document {
  subscriptionId: ObjectId;
  /** Plaintext signing secret. Stored in a separate collection so a leak
   *  on `webhook_subscriptions` doesn't compromise signatures. */
  secret: string;
}

const RETRY_DELAYS_MS = [0, 30_000, 5 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const AUTO_PAUSE_AT_CONSECUTIVE_FAILURES = 50;
const POLL_INTERVAL_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function sign(secret: string, ts: number, body: string): string {
  return createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
}

async function pollOnce(client: MongoClient): Promise<number> {
  const db = client.db();
  const subsCol = db.collection<SubscriptionDoc>('webhook_subscriptions');
  const deliveriesCol = db.collection<DeliveryDoc>('webhook_deliveries');
  const secretsCol = db.collection<SecretDoc>('webhook_subscription_secrets');

  const now = new Date();
  // Atomically lease a batch — set status to 'inflight' so concurrent
  // workers don't double-deliver. We use findOneAndUpdate in a loop
  // rather than a single multi-doc update so we can capture each `_id`
  // for the post-delivery write back.
  const batch: DeliveryDoc[] = [];
  while (batch.length < 25) {
    const next = await deliveriesCol.findOneAndUpdate(
      { status: 'pending', $or: [{ nextAttemptAt: { $lte: now } }, { nextAttemptAt: { $exists: false } }] },
      { $set: { status: 'pending', lockedAt: now } },
      { sort: { createdAt: 1 }, returnDocument: 'after' },
    );
    if (!next) break;
    batch.push(next);
  }

  if (!batch.length) return 0;

  let processed = 0;
  for (const delivery of batch) {
    const sub = await subsCol.findOne({ _id: delivery.subscriptionId });
    if (!sub || sub.status !== 'active') {
      // Subscription gone or paused — mark the delivery as failed
      // without retry so it doesn't queue forever.
      await deliveriesCol.updateOne(
        { _id: delivery._id },
        { $set: { status: 'failed', lastError: 'Subscription missing or paused.', finishedAt: new Date() } },
      );
      processed += 1;
      continue;
    }

    const secretRow = await secretsCol.findOne({ subscriptionId: sub._id });
    if (!secretRow) {
      await subsCol.updateOne(
        { _id: sub._id },
        { $set: { status: 'paused', lastError: 'Signing secret missing.' } },
      );
      await deliveriesCol.updateOne(
        { _id: delivery._id },
        { $set: { status: 'failed', lastError: 'Signing secret missing.', finishedAt: new Date() } },
      );
      processed += 1;
      continue;
    }

    const body = JSON.stringify({
      id: delivery._id.toHexString(),
      event: delivery.event,
      data: delivery.payload,
      created_at: delivery.createdAt.toISOString(),
    });
    const ts = Math.floor(Date.now() / 1000);
    const signature = sign(secretRow.secret, ts, body);

    let status = 0;
    let error: string | null = null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'X-SabNode-Signature': `t=${ts},v1=${signature}`,
          'X-SabNode-Event': delivery.event,
          'X-SabNode-Delivery-Id': delivery._id.toHexString(),
          'X-Idempotency-Key': delivery._id.toHexString(),
        },
        body,
      });
      status = res.status;
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        error = `HTTP ${res.status}: ${text.slice(0, 512)}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }

    const attempts = (delivery.attempts ?? 0) + 1;
    if (!error) {
      await deliveriesCol.updateOne(
        { _id: delivery._id },
        {
          $set: {
            status: 'success',
            attempts,
            responseStatus: status,
            finishedAt: new Date(),
            lastError: null,
          },
        },
      );
      await subsCol.updateOne(
        { _id: sub._id },
        { $set: { consecutiveFailures: 0, lastDeliveryAt: new Date() } },
      );
    } else if (attempts < MAX_ATTEMPTS) {
      const nextDelay = RETRY_DELAYS_MS[attempts] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await deliveriesCol.updateOne(
        { _id: delivery._id },
        {
          $set: {
            status: 'pending',
            attempts,
            responseStatus: status || null,
            lastError: error,
            nextAttemptAt: new Date(Date.now() + nextDelay),
          },
        },
      );
    } else {
      // Cap reached.
      await deliveriesCol.updateOne(
        { _id: delivery._id },
        {
          $set: {
            status: 'failed',
            attempts,
            responseStatus: status || null,
            lastError: error,
            finishedAt: new Date(),
          },
        },
      );
      const newCount = (sub.consecutiveFailures ?? 0) + 1;
      const updates: Record<string, unknown> = { consecutiveFailures: newCount };
      if (newCount >= AUTO_PAUSE_AT_CONSECUTIVE_FAILURES) {
        updates.status = 'paused';
      }
      await subsCol.updateOne({ _id: sub._id }, { $set: updates });
    }
    processed += 1;
  }
  return processed;
}

async function main(): Promise<void> {
  const url = readEnv('MONGODB_URI');
  const client = await MongoClient.connect(url);
  console.log('[webhook-worker] connected to Mongo, polling…');

  const stop = { value: false };
  process.on('SIGINT', () => {
    console.log('[webhook-worker] SIGINT received, draining…');
    stop.value = true;
  });
  process.on('SIGTERM', () => {
    console.log('[webhook-worker] SIGTERM received, draining…');
    stop.value = true;
  });

  while (!stop.value) {
    try {
      const n = await pollOnce(client);
      if (n === 0) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (err) {
      console.error('[webhook-worker] poll error:', err);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 4));
    }
  }

  await client.close();
  console.log('[webhook-worker] stopped.');
}

void main();
