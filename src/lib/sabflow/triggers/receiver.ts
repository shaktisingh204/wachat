/**
 * SabFlow — chat/message trigger receiver helpers (Phase 6 Track B).
 *
 * Used by the Slack and Telegram internal HTTP receivers under
 * `src/app/api/sabflow/webhook/` and `src/app/api/sabflow/internal/`.
 *
 * Responsibilities:
 *   1. Dedup inbound events via Redis (SHA-256 of normalised payload, 5 min TTL).
 *   2. Find matching rows in `sabflow_triggers` (forward-declared collection).
 *   3. Enqueue one BullMQ execute-job per matching flow on `SABFLOW_QUEUE`.
 *
 * Lookups never throw on the request path — callers must respond within
 * the provider's signing/timeout window (Slack 3s, Telegram <60s). All
 * enqueue work runs inside `after()` at the call site (fire-and-forget).
 */

import crypto from 'node:crypto';
import { Queue } from 'bullmq';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { SABFLOW_QUEUE } from '@/lib/sabflow/worker/queues';

// ── Redis / queue singletons ───────────────────────────────────────────────

const redisConn = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

let _queue: Queue | null = null;
function getQueue(): Queue {
  if (!_queue) _queue = new Queue(SABFLOW_QUEUE, { connection: redisConn });
  return _queue;
}

// Lazy-loaded ioredis client used only for dedup SETNX checks.
let _redisClient: import('ioredis').default | null = null;
async function getRedis(): Promise<import('ioredis').default | null> {
  if (_redisClient) return _redisClient;
  try {
    const mod = (await import('ioredis')) as unknown as { default: new (opts: unknown) => import('ioredis').default };
    const Ctor = mod.default;
    _redisClient = new Ctor({ ...redisConn, lazyConnect: false, maxRetriesPerRequest: 1 });
    return _redisClient;
  } catch {
    return null;
  }
}

// ── Dedup ──────────────────────────────────────────────────────────────────

const DEDUP_TTL_SECONDS = 5 * 60; // 5 min per spec.

/**
 * Compute a stable SHA-256 fingerprint of the normalised payload. Slack /
 * Telegram all include their own message/update id which we lean on,
 * but we hash the full normalised object so retries with identical bodies
 * also dedup.
 */
export function fingerprintPayload(source: string, payload: unknown): string {
  const json = JSON.stringify(payload, Object.keys(payload as Record<string, unknown> ?? {}).sort());
  return crypto.createHash('sha256').update(`${source}:${json}`).digest('hex');
}

/**
 * Returns true the FIRST time a fingerprint is seen, false on subsequent
 * calls within the TTL window. If Redis is unreachable we fail-open
 * (return true) so a Redis outage doesn't silently drop events.
 */
export async function claimFingerprint(fingerprint: string): Promise<boolean> {
  const r = await getRedis();
  if (!r) return true;
  try {
    const key = `sabflow:trigger-dedup:${fingerprint}`;
    const result = await r.set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
    return result === 'OK';
  } catch {
    return true;
  }
}

// ── Trigger lookup + enqueue ───────────────────────────────────────────────

export type TriggerSource = 'slack' | 'telegram' | 'sabcrm';

export interface TriggerMatchHint {
  /** Provider-side identifier of the workspace/team/account/session. */
  externalId?: string;
  /** Provider-side identifier of the chat/channel/conversation. */
  chatId?: string;
  /** App-event slug, eg "slack.message", "telegram.message". */
  appEvent: string;
}

interface TriggerDoc {
  _id: ObjectId;
  flowId: string;
  projectId: string;
  source: TriggerSource;
  appEvent: string;
  externalId?: string;
  chatId?: string;
  isActive?: boolean;
}

/**
 * Look up active rows in `sabflow_triggers` matching this inbound event.
 * Matching is permissive: a row matches when its `source`+`appEvent` agree
 * and any provided externalId/chatId either match the hint or are absent
 * (treated as wildcard).
 */
export async function findMatchingTriggers(
  source: TriggerSource,
  hint: TriggerMatchHint,
): Promise<TriggerDoc[]> {
  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = {
      source,
      appEvent: hint.appEvent,
      isActive: { $ne: false },
    };
    if (hint.externalId) {
      query.$and = [
        { $or: [{ externalId: hint.externalId }, { externalId: { $exists: false } }, { externalId: null }] },
      ];
    }
    const rows = (await db.collection('sabflow_triggers').find(query).limit(50).toArray()) as unknown as TriggerDoc[];
    if (!hint.chatId) return rows;
    return rows.filter(
      (row) => !row.chatId || row.chatId === hint.chatId,
    );
  } catch {
    return [];
  }
}

export interface EnqueueOpts {
  source: TriggerSource;
  hint: TriggerMatchHint;
  payload: Record<string, unknown>;
  fingerprint: string;
}

/**
 * Enqueue one execute job per matching trigger. Each job carries the flow
 * snapshot so the worker can run without an extra Mongo round-trip.
 */
export async function enqueueTriggerJobs(opts: EnqueueOpts): Promise<number> {
  const triggers = await findMatchingTriggers(opts.source, opts.hint);
  if (triggers.length === 0) return 0;
  const { db } = await connectToDatabase();
  const queue = getQueue();

  let enqueued = 0;
  for (const trigger of triggers) {
    try {
      const flow = await db.collection('sabflows').findOne(
        ObjectId.isValid(trigger.flowId)
          ? { _id: new ObjectId(trigger.flowId), userId: trigger.projectId }
          : { userId: trigger.projectId },
      );
      if (!flow) continue;

      const executionId = new ObjectId().toHexString();
      const now = new Date();
      await db.collection('sabflow_executions').insertOne({
        executionId,
        flowId: trigger.flowId,
        projectId: trigger.projectId,
        status: 'queued',
        triggerMode: 'trigger',
        triggerSource: opts.source,
        triggerFingerprint: opts.fingerprint,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      });

      await queue.add(
        'execute',
        {
          executionId,
          flowId: trigger.flowId,
          projectId: trigger.projectId,
          flowSnapshot: flow,
          triggerMode: 'trigger',
          triggerSource: opts.source,
          triggerData: opts.payload,
          variables: {},
        },
        {
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 500 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
      enqueued += 1;
    } catch (err) {
      console.error('[sabflow][trigger] enqueue failed', { flowId: trigger.flowId, err });
    }
  }
  return enqueued;
}

// ── Crypto helpers ─────────────────────────────────────────────────────────

export function timingSafeStringEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
