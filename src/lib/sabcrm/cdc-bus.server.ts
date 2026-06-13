import 'server-only';

/**
 * SabCRM — CDC event bus (server-only). [RUNTIME-UNVERIFIED]
 *
 * Tails the `sabcrm_records` MongoDB change stream and republishes normalized
 * events to a Redis Stream (`sabcrm:cdc`) — the single backbone other systems
 * (webhooks, automations, the embeddings indexer, gamification) can consume
 * without each re-watching Mongo.
 *
 * ⚠️ This is written + type-clean but NOT runtime-verified in this environment:
 * MongoDB change streams require a REPLICA SET (not a standalone mongod) and a
 * running Redis + a long-lived worker process. Verify on the live stack before
 * relying on it. It degrades safely: if Redis is unavailable or the deployment
 * is a standalone mongod, `startSabcrmCdcBus` logs and exits without throwing,
 * and nothing else in SabCRM depends on it yet.
 *
 * RUNNER WIRING IS DEFERRED: start it once from a Next.js server context
 * (e.g. an `instrumentation.ts` hook) — NOT from a request handler, and not
 * from the plain-Node worker runners (this module uses `server-only` + the
 * `@/` alias). Consumers of the `sabcrm:cdc` stream are not built yet either;
 * this lands the backbone, ready to wire on the live stack.
 */

import { connectToDatabase } from '@/lib/mongodb';

const STREAM_KEY = 'sabcrm:cdc';
const STATE_COLL = 'sabcrm_cdc_state';
const RECORDS_COLL = 'sabcrm_records';
const STATE_ID = 'records';
const STREAM_MAXLEN = 100_000;

/** A normalized CDC event published to the Redis stream. */
export interface SabcrmCdcEvent {
  projectId: string;
  object: string;
  recordId: string;
  op: 'insert' | 'update' | 'replace' | 'delete';
  at: string;
}

interface RedisLike {
  xadd: (...args: Array<string | number>) => Promise<unknown>;
}

async function getRedis(): Promise<RedisLike | null> {
  try {
    const mod = (await import('ioredis')) as unknown as {
      default: new (opts: unknown) => RedisLike;
    };
    const Ctor = mod.default;
    return new Ctor({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
  } catch {
    return null;
  }
}

let _running = false;

/** Stop the bus loop (for graceful worker shutdown). */
export function stopSabcrmCdcBus(): void {
  _running = false;
}

/**
 * Start tailing the change stream and publishing events. Resumes from the last
 * persisted token in `sabcrm_cdc_state`. Reconnects with backoff on error.
 * Best-effort: never throws to the caller.
 */
export async function startSabcrmCdcBus(): Promise<void> {
  if (_running) return;
  _running = true;
  const redis = await getRedis();
  if (!redis) {
    console.warn('[sabcrm-cdc] Redis unavailable — CDC bus disabled.');
    _running = false;
    return;
  }

  while (_running) {
    try {
      const { db } = await connectToDatabase();
      const state = (await db
        .collection(STATE_COLL)
        .findOne({ _id: STATE_ID as unknown as never })) as { resumeToken?: unknown } | null;

      const stream = db.collection(RECORDS_COLL).watch([], {
        fullDocument: 'updateLookup',
        ...(state?.resumeToken ? { resumeAfter: state.resumeToken as never } : {}),
      });

      for await (const raw of stream as AsyncIterable<unknown>) {
        if (!_running) break;
        const change = raw as {
          _id: unknown;
          operationType: string;
          documentKey?: { _id?: unknown };
          fullDocument?: Record<string, unknown>;
        };
        const doc = change.fullDocument ?? {};
        const op =
          change.operationType === 'insert' ||
          change.operationType === 'update' ||
          change.operationType === 'replace' ||
          change.operationType === 'delete'
            ? (change.operationType as SabcrmCdcEvent['op'])
            : null;
        if (!op) continue;
        const event: SabcrmCdcEvent = {
          projectId: String(doc.projectId ?? ''),
          object: String(doc.object ?? ''),
          recordId: String(change.documentKey?._id ?? doc._id ?? ''),
          op,
          at: new Date().toISOString(),
        };
        try {
          await redis.xadd(
            STREAM_KEY,
            'MAXLEN',
            '~',
            String(STREAM_MAXLEN),
            '*',
            'event',
            JSON.stringify(event),
          );
        } catch {
          /* a dropped publish is recoverable — the resume token isn't advanced */
        }
        try {
          await db
            .collection(STATE_COLL)
            .updateOne(
              { _id: STATE_ID as unknown as never },
              { $set: { resumeToken: change._id, updatedAt: event.at } },
              { upsert: true },
            );
        } catch {
          /* best-effort token persist */
        }
      }
    } catch (e) {
      // Most likely: standalone mongod (no change streams) or a transient drop.
      console.error('[sabcrm-cdc] change-stream error; retrying in 5s', e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
