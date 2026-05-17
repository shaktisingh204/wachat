/**
 * Vercel Cron entry for the webhook dispatcher.
 *
 * Replaces `services/webhook-worker/index.ts` (PM2 polling loop) so the
 * deployment stays Vercel-native per the project-wide policy in
 * `CLAUDE.md`: no node-cron, no Bull workers, no PM2 long-running
 * processes.
 *
 * Triggered by a Vercel Cron schedule declared in `vercel.ts`:
 *
 *   crons: [{ path: '/api/cron/webhook-dispatcher', schedule: '* * * * *' }]
 *
 * Each invocation drains up to `MAX_BATCH` pending deliveries from
 * `webhook_deliveries`, signs them with the per-subscription HMAC
 * secret pulled from `webhook_subscription_secrets`, and POSTs to the
 * subscriber URL with a hard 10s per-delivery timeout. Failed
 * deliveries are scheduled per the retry table.
 *
 * Auth: Vercel Cron requests carry `Authorization: Bearer $CRON_SECRET`.
 * Reject anything else so a stray request can't trigger fan-out.
 */

import 'server-only';

import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { MongoClient, ObjectId, type Document } from 'mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel function cap; aligns with cron cadence

const RETRY_DELAYS_MS = [0, 30_000, 5 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const AUTO_PAUSE_AT = 50;
const MAX_BATCH = 50;
const REQUEST_TIMEOUT_MS = 10_000;

interface SubDoc extends Document {
  _id: ObjectId;
  url: string;
  status: 'active' | 'paused' | 'failed';
  consecutiveFailures?: number;
}
interface DeliveryDoc extends Document {
  _id: ObjectId;
  subscriptionId: ObjectId;
  event: string;
  payload: unknown;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  nextAttemptAt?: Date;
  createdAt: Date;
}
interface SecretDoc extends Document {
  subscriptionId: ObjectId;
  secret: string;
}

function sign(secret: string, ts: number, body: string): string {
  return createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
}

async function drain(client: MongoClient): Promise<{ processed: number }> {
  const db = client.db();
  const subsCol = db.collection<SubDoc>('webhook_subscriptions');
  const delsCol = db.collection<DeliveryDoc>('webhook_deliveries');
  const secsCol = db.collection<SecretDoc>('webhook_subscription_secrets');

  const now = new Date();
  let processed = 0;

  for (let i = 0; i < MAX_BATCH; i++) {
    const next = await delsCol.findOneAndUpdate(
      {
        status: 'pending',
        $or: [{ nextAttemptAt: { $lte: now } }, { nextAttemptAt: { $exists: false } }],
      },
      { $set: { lockedAt: now } },
      { sort: { createdAt: 1 }, returnDocument: 'after' },
    );
    if (!next) break;

    const sub = await subsCol.findOne({ _id: next.subscriptionId });
    if (!sub || sub.status !== 'active') {
      await delsCol.updateOne(
        { _id: next._id },
        { $set: { status: 'failed', lastError: 'Subscription missing or paused.', finishedAt: new Date() } },
      );
      processed += 1;
      continue;
    }

    const secret = await secsCol.findOne({ subscriptionId: sub._id });
    if (!secret) {
      await subsCol.updateOne({ _id: sub._id }, { $set: { status: 'paused' } });
      await delsCol.updateOne(
        { _id: next._id },
        { $set: { status: 'failed', lastError: 'Signing secret missing.', finishedAt: new Date() } },
      );
      processed += 1;
      continue;
    }

    const body = JSON.stringify({
      id: next._id.toHexString(),
      event: next.event,
      data: next.payload,
      created_at: next.createdAt.toISOString(),
    });
    const ts = Math.floor(Date.now() / 1000);
    const signature = sign(secret.secret, ts, body);

    let status = 0;
    let error: string | null = null;
    // Per-fetch hard timeout — the standard AbortController + setTimeout
    // idiom. NOT a polling loop; the timer fires once per delivery and is
    // cleared in `finally`. The dispatcher itself runs as a cron-triggered
    // bounded drain (max MAX_BATCH = 50 deliveries per invocation) so it
    // fits cleanly inside a Vercel Function's 60s budget.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'X-SabNode-Signature': `t=${ts},v1=${signature}`,
          'X-SabNode-Event': next.event,
          'X-SabNode-Delivery-Id': next._id.toHexString(),
          'X-Idempotency-Key': next._id.toHexString(),
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

    const attempts = (next.attempts ?? 0) + 1;
    if (!error) {
      await delsCol.updateOne(
        { _id: next._id },
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
      const delay = RETRY_DELAYS_MS[attempts] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await delsCol.updateOne(
        { _id: next._id },
        {
          $set: {
            status: 'pending',
            attempts,
            responseStatus: status || null,
            lastError: error,
            nextAttemptAt: new Date(Date.now() + delay),
          },
        },
      );
    } else {
      await delsCol.updateOne(
        { _id: next._id },
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
      if (newCount >= AUTO_PAUSE_AT) updates.status = 'paused';
      await subsCol.updateOne({ _id: sub._id }, { $set: updates });
    }
    processed += 1;
  }

  return { processed };
}

export async function GET(req: Request): Promise<NextResponse> {
  const start = Date.now();
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected || !auth.startsWith('Bearer ') || auth.slice(7) !== expected) {
    console.warn('[cron.webhook-dispatcher] unauthorized invocation');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[cron.webhook-dispatcher] MONGODB_URI not set');
    return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 500 });
  }

  // Reuse a hot connection in the same function instance — Fluid Compute
  // keeps modules warm so this saves the connect cost on subsequent ticks.
  const g = globalThis as { __sabnode_webhook_mongo?: MongoClient };
  if (!g.__sabnode_webhook_mongo) {
    g.__sabnode_webhook_mongo = await MongoClient.connect(uri);
  }
  try {
    const { processed } = await drain(g.__sabnode_webhook_mongo);
    const elapsedMs = Date.now() - start;
    console.log(
      JSON.stringify({
        msg: 'cron.webhook-dispatcher.ok',
        processed,
        elapsedMs,
        ts: new Date().toISOString(),
      }),
    );
    return NextResponse.json({ ok: true, processed, elapsedMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        msg: 'cron.webhook-dispatcher.failed',
        error: message,
        elapsedMs: Date.now() - start,
        ts: new Date().toISOString(),
      }),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
