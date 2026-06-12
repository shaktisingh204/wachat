/**
 * SabSMS engine-event consumer — Redis Stream `sabsms:events`.
 *
 * The Rust engine (`services/sabsms-engine/src/events.rs`) XADDs every
 * domain event to the `sabsms:events` stream with three fields:
 *
 *   kind     camelCase tag, e.g. "messageInbound"
 *   payload  JSON string of the whole serde-tagged event
 *            (`{"kind":"messageSent","workspaceId":"...","segments":2}`
 *            — field names are camelCase via `rename_all_fields`)
 *   at       epoch milliseconds
 *
 * This module is the Next.js-side counterpart: a consumer-group reader
 * (group `sabsms-next`) that parses entries, routes them through a
 * kind→handler registry, and XACKs on success. A periodic XAUTOCLAIM
 * sweep (idle ≥ 60 s) recovers entries left pending by crashed
 * consumers.
 *
 * IMPORTANT: this file runs inside the standalone PM2 worker
 * (`scripts/sabsms-events-worker.mjs` under tsx) — it must NOT import
 * `server-only` or any Next.js-coupled module. It owns its own ioredis
 * + MongoClient connections (mirroring `src/workers/sabflow-worker.ts`).
 *
 * Handlers MUST tolerate replays: delivery is at-least-once (an entry
 * is re-delivered if the process dies between handling and XACK, and
 * again via XAUTOCLAIM). The stream entry id is the event id — the
 * event-log handler upserts on it, the poke handler is a plain SET.
 */

import os from 'node:os';
import Redis from 'ioredis';
import { MongoClient, type Collection, type Db } from 'mongodb';

// V2.9 — journeys ride the same worker process (handlers + 5 s ticker).
import { tickJourneys } from '../journeys/executor';
import { registerJourneyEventHandlers } from '../journeys/handlers';
import { createMongoJourneyStore, ensureJourneyIndexes } from '../journeys/store';
// V2.10 — analytics rollups + identity graph (additive registrations).
import { registerAnalyticsEventHandlers } from '../analytics/handlers';
import { registerIdentityEventHandlers } from '../identity/handlers';
// V2.12 — AI agent guardrails + runtime (additive registration).
import { registerAgentEventHandlers } from '../agent/handlers';

// ─── Constants (mirror services/sabsms-engine/src/events.rs) ─────────────

export const SABSMS_EVENTS_STREAM = 'sabsms:events';
export const SABSMS_EVENTS_GROUP = 'sabsms-next';
export const SABSMS_EVENT_LOG_COLLECTION = 'sabsms_event_log';

/** Days the debugging/analytics event log is retained (TTL index). */
export const EVENT_LOG_TTL_DAYS = 30;

/** Pending entries idle longer than this are reclaimed from dead consumers. */
export const AUTOCLAIM_IDLE_MS = 60_000;

/** Cheap "something changed" key the inbox UI polling can consult. */
export function inboxPokeKey(workspaceId: string): string {
  return `sabsms:inbox:poke:${workspaceId}`;
}

/** Mirror of the Rust `EngineEvent::kind()` tags. */
export const ENGINE_EVENT_KINDS = [
  'messageQueued',
  'messageSent',
  'messageFailed',
  'messageDelivered',
  'messageInbound',
  'contactUnsubscribed',
  'complianceBlocked',
  'complianceRescheduled',
] as const;

export type EngineEventKind = (typeof ENGINE_EVENT_KINDS)[number];

// ─── Parsing (pure — unit-tested without Redis) ───────────────────────────

export interface SabsmsEngineEvent {
  /** camelCase serde tag, e.g. `messageInbound`. */
  kind: string;
  /**
   * Parsed payload object. Because the Rust enum is internally tagged,
   * the payload JSON repeats `kind` alongside the camelCase data fields
   * (`workspaceId`, `messageId`, ...).
   */
  payload: Record<string, unknown>;
  /** Engine-stamped epoch milliseconds (0 when absent/malformed). */
  at: number;
}

export type ParsedStreamEntry =
  | { id: string; ok: true; event: SabsmsEngineEvent }
  | { id: string; ok: false; error: string };

/**
 * Parse one XREADGROUP/XAUTOCLAIM entry. `fields` is the flat
 * `[k1, v1, k2, v2, ...]` array ioredis returns.
 *
 * Malformed entries (missing kind, invalid payload JSON, non-object
 * payload) come back `ok: false` — the consumer logs them and XACKs so
 * a single poison entry can never wedge the group.
 */
export function parseStreamEntry(
  id: string,
  fields: ReadonlyArray<string>,
): ParsedStreamEntry {
  const map: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) {
    map[fields[i]] = fields[i + 1];
  }

  const kind = map.kind;
  if (!kind) return { id, ok: false, error: 'missing "kind" field' };

  let payload: unknown = {};
  if (map.payload !== undefined) {
    try {
      payload = JSON.parse(map.payload);
    } catch {
      return { id, ok: false, error: 'payload is not valid JSON' };
    }
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { id, ok: false, error: 'payload is not a JSON object' };
  }

  const at = Number(map.at);
  return {
    id,
    ok: true,
    event: {
      kind,
      payload: payload as Record<string, unknown>,
      at: Number.isFinite(at) ? at : 0,
    },
  };
}

/** Convenience accessor — every engine event carries `workspaceId`. */
export function eventWorkspaceId(event: SabsmsEngineEvent): string {
  const ws = event.payload.workspaceId;
  return typeof ws === 'string' ? ws : '';
}

// ─── Handler registry (pure routing — unit-tested) ────────────────────────

export interface HandlerContext {
  /** Redis stream entry id — the event's identity for idempotency. */
  entryId: string;
  redis: Pick<Redis, 'set'>;
  eventLog: Pick<Collection, 'updateOne'>;
  log: (message: string, extra?: Record<string, unknown>) => void;
  /**
   * Mongo handle for handlers that need their own collections (V2.9
   * journeys). Optional — pure-router unit tests omit it and the
   * journey handlers no-op without it.
   */
  db?: Db;
}

export type SabsmsEventHandler = (
  event: SabsmsEngineEvent,
  ctx: HandlerContext,
) => void | Promise<void>;

/** Wildcard key — handlers registered under it run for EVERY kind. */
export const ALL_KINDS = '*';

export class SabsmsEventRouter {
  private handlers = new Map<string, SabsmsEventHandler[]>();

  on(kind: string, handler: SabsmsEventHandler): this {
    const list = this.handlers.get(kind) ?? [];
    list.push(handler);
    this.handlers.set(kind, list);
    return this;
  }

  /** Kind-specific handlers first, then the `*` catch-alls. */
  handlersFor(kind: string): SabsmsEventHandler[] {
    return [
      ...(this.handlers.get(kind) ?? []),
      ...(this.handlers.get(ALL_KINDS) ?? []),
    ];
  }

  /**
   * Run every matching handler sequentially. Throws on the first
   * handler error so the caller skips the XACK and the entry is
   * redelivered/claimed later.
   */
  async dispatch(event: SabsmsEngineEvent, ctx: HandlerContext): Promise<number> {
    const handlers = this.handlersFor(event.kind);
    for (const handler of handlers) {
      await handler(event, ctx);
    }
    return handlers.length;
  }
}

// ─── Default handlers ─────────────────────────────────────────────────────

/**
 * Build the production router:
 *
 *  - `messageInbound`      → bump `sabsms:inbox:poke:{workspaceId}` so the
 *                            inbox UI's cheap poll knows something changed
 *                            (unread counters are already engine-side).
 *  - `contactUnsubscribed` → log (suppression itself is engine-side).
 *  - `*`                   → append to the `sabsms_event_log` collection
 *                            (30-day TTL) for debugging / analytics
 *                            backfill. Upserts on the stream entry id so
 *                            replays never duplicate.
 */
export function createDefaultRouter(): SabsmsEventRouter {
  const router = new SabsmsEventRouter();

  router.on('messageInbound', async (event, ctx) => {
    const workspaceId = eventWorkspaceId(event);
    ctx.log('messageInbound', {
      workspaceId,
      conversationId: event.payload.conversationId,
      messageId: event.payload.messageId,
    });
    if (!workspaceId) return;
    // Cheap freshness marker for UI polling; expires on its own so the
    // keyspace can never grow unbounded.
    await ctx.redis.set(inboxPokeKey(workspaceId), String(Date.now()), 'EX', 600);
  });

  router.on('contactUnsubscribed', (event, ctx) => {
    ctx.log('contactUnsubscribed', {
      workspaceId: eventWorkspaceId(event),
      source: event.payload.source,
    });
  });

  router.on(ALL_KINDS, async (event, ctx) => {
    await ctx.eventLog.updateOne(
      { streamId: ctx.entryId },
      {
        $setOnInsert: {
          streamId: ctx.entryId,
          workspaceId: eventWorkspaceId(event),
          kind: event.kind,
          payload: event.payload,
          at: event.at > 0 ? new Date(event.at) : new Date(),
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  });

  // V2.9 — journey reactions (wake/exit/enrol). Additive: each handler
  // no-ops when `ctx.db` is absent, so V2.2 behaviour is unchanged.
  registerJourneyEventHandlers(router);

  // V2.10 — daily rollups (`sabsms_stats_daily`, wildcard) + identity
  // graph (`sabsms_identities`, per-kind). Both no-op without `ctx.db`.
  registerAnalyticsEventHandlers(router);
  registerIdentityEventHandlers(router);

  // V2.12 — AI agent: opt-out guardrail THEN agent runtime on
  // `messageInbound` (ordering enforced inside the registration —
  // see `../agent/handlers.ts`). No-ops without `ctx.db`.
  registerAgentEventHandlers(router);

  return router;
}

// ─── Runtime (Redis + Mongo plumbing) ─────────────────────────────────────

export interface SabsmsEventsConsumerOptions {
  router?: SabsmsEventRouter;
  /** Defaults to `{hostname}-{pid}` — unique per process, stable per run. */
  consumerName?: string;
  blockMs?: number;
  batchSize?: number;
  autoclaimIntervalMs?: number;
  /** V2.9 journey executor tick interval (default 5 s). */
  journeyTickMs?: number;
  /** Disable the in-process journey ticker (tests / secondary consumers). */
  disableJourneyTicker?: boolean;
}

export interface SabsmsEventsConsumer {
  /** Resolves when the read loop has fully drained and exited. */
  done: Promise<void>;
  stop: () => Promise<void>;
}

function createRedis(): Redis {
  // Same connection convention as the sabflow PM2 workers — REDIS_URL
  // wins when set (the sabsms-engine PM2 app uses it), otherwise the
  // discrete host/port/password vars. NOTE: `||` not `??` — an empty
  // env string must fall through (see sabflow worker trap).
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    maxRetriesPerRequest: null,
  });
}

async function connectMongo(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL || '';
  if (!uri) throw new Error('[sabsms-events] MONGODB_URI is not set');
  const client = new MongoClient(uri, { maxPoolSize: 4 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'sabnode');
  return { client, db };
}

async function ensureEventLogIndexes(eventLog: Collection): Promise<void> {
  // Mongo forbids TTL indexes on capped collections, so the "capped"
  // behaviour is delivered by the 30-day TTL instead (per the V2.2 spec
  // the retention bound is the requirement, not the storage engine).
  await eventLog.createIndex({ streamId: 1 }, { unique: true });
  await eventLog.createIndex(
    { at: 1 },
    { expireAfterSeconds: EVENT_LOG_TTL_DAYS * 24 * 60 * 60 },
  );
  await eventLog.createIndex({ workspaceId: 1, kind: 1, at: -1 });
}

async function ensureGroup(redis: Redis): Promise<void> {
  try {
    await redis.xgroup(
      'CREATE',
      SABSMS_EVENTS_STREAM,
      SABSMS_EVENTS_GROUP,
      '$',
      'MKSTREAM',
    );
  } catch (err) {
    // BUSYGROUP = the group already exists; anything else is fatal.
    if (!(err instanceof Error && err.message.includes('BUSYGROUP'))) {
      throw err;
    }
  }
}

type StreamEntry = [id: string, fields: string[]];

/**
 * Start the consumer. Returns a handle whose `stop()` requests a
 * graceful shutdown (finish the in-flight batch, then close Redis +
 * Mongo) and whose `done` resolves once everything is closed.
 */
export async function runSabsmsEventsConsumer(
  options: SabsmsEventsConsumerOptions = {},
): Promise<SabsmsEventsConsumer> {
  const router = options.router ?? createDefaultRouter();
  const consumerName =
    options.consumerName ?? `${os.hostname()}-${process.pid}`;
  const blockMs = options.blockMs ?? 5_000;
  const batchSize = options.batchSize ?? 50;
  const autoclaimIntervalMs = options.autoclaimIntervalMs ?? 30_000;

  const redis = createRedis();
  const { client: mongoClient, db } = await connectMongo();
  const eventLog = db.collection(SABSMS_EVENT_LOG_COLLECTION);

  await ensureEventLogIndexes(eventLog);
  await ensureGroup(redis);

  const log = (message: string, extra?: Record<string, unknown>) => {
    const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
    console.log(`[sabsms-events] ${message}${suffix}`);
  };

  log(`consumer started`, {
    stream: SABSMS_EVENTS_STREAM,
    group: SABSMS_EVENTS_GROUP,
    consumer: consumerName,
  });

  let running = true;
  let lastAutoclaimAt = 0;

  // ─── V2.9 journey ticker ────────────────────────────────────────────
  // The journey executor shares this worker process (it already owns the
  // Mongo handle + lifecycle): a 5 s interval claims due runs and sweeps
  // A/B promotions. Overlap-guarded so a slow tick never stacks.
  let journeyTicker: ReturnType<typeof setInterval> | null = null;
  if (!options.disableJourneyTicker) {
    await ensureJourneyIndexes(db);
    const journeyStore = createMongoJourneyStore(db);
    let journeyTickInFlight = false;
    journeyTicker = setInterval(() => {
      if (journeyTickInFlight || !running) return;
      journeyTickInFlight = true;
      tickJourneys({ store: journeyStore, log })
        .then((res) => {
          if (res.claimed > 0 || res.promotedWinners > 0) {
            log('journey tick', { ...res });
          }
        })
        .catch((err) => {
          log('journey tick failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        })
        .finally(() => {
          journeyTickInFlight = false;
        });
    }, options.journeyTickMs ?? 5_000);
  }

  async function handleEntries(entries: StreamEntry[]): Promise<void> {
    for (const [id, fields] of entries) {
      const parsed = parseStreamEntry(id, fields);
      if (!parsed.ok) {
        // Poison entry — log + ACK so it never wedges the group.
        log(`skipping malformed entry`, { id, error: parsed.error });
        await redis.xack(SABSMS_EVENTS_STREAM, SABSMS_EVENTS_GROUP, id);
        continue;
      }
      try {
        await router.dispatch(parsed.event, {
          entryId: id,
          redis,
          eventLog,
          log,
          db,
        });
        await redis.xack(SABSMS_EVENTS_STREAM, SABSMS_EVENTS_GROUP, id);
      } catch (err) {
        // No XACK — the entry stays pending and is retried via
        // redelivery/XAUTOCLAIM. Handlers are replay-tolerant.
        log(`handler failed; entry left pending for retry`, {
          id,
          kind: parsed.event.kind,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /** Reclaim entries stuck pending on crashed consumers (idle ≥ 60 s). */
  async function autoclaimSweep(): Promise<void> {
    let cursor = '0-0';
    // Loop until the cursor wraps to 0-0 (full PEL scan) or we go idle.
    for (;;) {
      const reply = (await redis.xautoclaim(
        SABSMS_EVENTS_STREAM,
        SABSMS_EVENTS_GROUP,
        consumerName,
        AUTOCLAIM_IDLE_MS,
        cursor,
        'COUNT',
        batchSize,
      )) as [string, StreamEntry[] | null, ...unknown[]];
      const [nextCursor, claimed] = reply;
      if (claimed && claimed.length > 0) {
        log(`autoclaim recovered entries`, { count: claimed.length });
        // ioredis may return `null` fields for entries deleted from the
        // stream (XAUTOCLAIM tombstones) — drop those.
        await handleEntries(claimed.filter((e) => Array.isArray(e?.[1])));
      }
      cursor = nextCursor;
      if (!claimed || claimed.length === 0 || cursor === '0-0') break;
      if (!running) break;
    }
  }

  const done = (async () => {
    while (running) {
      try {
        if (Date.now() - lastAutoclaimAt >= autoclaimIntervalMs) {
          lastAutoclaimAt = Date.now();
          await autoclaimSweep();
        }

        const reply = (await redis.xreadgroup(
          'GROUP',
          SABSMS_EVENTS_GROUP,
          consumerName,
          'COUNT',
          batchSize,
          'BLOCK',
          blockMs,
          'STREAMS',
          SABSMS_EVENTS_STREAM,
          '>',
        )) as Array<[string, StreamEntry[]]> | null;

        if (!reply) continue; // BLOCK timed out — loop (also re-checks `running`).
        for (const [, entries] of reply) {
          await handleEntries(entries);
        }
      } catch (err) {
        if (!running) break;
        log(`read loop error; backing off 2s`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }

    if (journeyTicker) clearInterval(journeyTicker);
    redis.disconnect();
    await mongoClient.close().catch(() => undefined);
    log('consumer stopped');
  })();

  return {
    done,
    stop: async () => {
      running = false;
      await done;
    },
  };
}
