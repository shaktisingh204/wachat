/**
 * In-process event bus for the data fabric.
 *
 * Two layers:
 *   1. A Node `EventEmitter` for in-process subscribers (cheap, synchronous
 *      fan-out to handlers running in the same Next.js worker).
 *   2. An ioredis pub/sub channel that mirrors every event so other workers
 *      (PM2, cron, broadcast worker) can subscribe to the same stream.
 *
 * Both layers are best-effort: a handler throwing or a Redis outage must not
 * block the originating write path. We always persist the event to
 * `df_events` first so the durable history is intact even when fan-out fails.
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import IORedis, { type Redis } from 'ioredis';
import { getEventsCollection, type EventDoc } from './db';
import type {
  DomainEvent,
  EventHandler,
  Unsubscribe,
} from './types';

const CHANNEL = 'sabnode:data-fabric:events';

/* ══════════════════════════════════════════════════════════
   Hot-reload-safe singletons
   ══════════════════════════════════════════════════════════ */

declare global {
  // eslint-disable-next-line no-var
  var __dataFabricEmitter: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __dataFabricPub: Redis | undefined;
  // eslint-disable-next-line no-var
  var __dataFabricSub: Redis | undefined;
  // eslint-disable-next-line no-var
  var __dataFabricSubReady: boolean | undefined;
}

const emitter: EventEmitter =
  globalThis.__dataFabricEmitter ?? new EventEmitter();
emitter.setMaxListeners(0);
if (!globalThis.__dataFabricEmitter) {
  globalThis.__dataFabricEmitter = emitter;
}

/** Lazy-create the publisher connection. */
function getPublisher(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (globalThis.__dataFabricPub) return globalThis.__dataFabricPub;
  try {
    const pub = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    pub.on('error', (err) => {
      // Connection failures are expected in test/dev — degrade silently.
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[data-fabric] redis publisher error:', err.message);
      }
    });
    globalThis.__dataFabricPub = pub;
    return pub;
  } catch {
    return null;
  }
}

/** Lazy-create the subscriber connection (only on first `subscribe`). */
function ensureSubscriber(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (globalThis.__dataFabricSub) return globalThis.__dataFabricSub;
  try {
    const sub = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    sub.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[data-fabric] redis subscriber error:', err.message);
      }
    });
    sub.on('message', (_chan, raw) => {
      try {
        const parsed = JSON.parse(raw) as DomainEvent;
        // Re-hydrate Date.
        parsed.occurredAt = new Date(parsed.occurredAt);
        emitter.emit('event', parsed);
      } catch {
        /* ignore malformed payloads */
      }
    });
    void sub.subscribe(CHANNEL).catch(() => {
      /* ignore — fall back to in-process only */
    });
    globalThis.__dataFabricSub = sub;
    globalThis.__dataFabricSubReady = true;
    return sub;
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════
   Public API
   ══════════════════════════════════════════════════════════ */

/**
 * Emit a domain event. Persists to `df_events`, fans out in-process, and
 * mirrors over Redis pub/sub. The promise resolves when the persistence write
 * completes — fan-out is fire-and-forget by design.
 */
export async function emit(
  tenantId: string,
  event: Omit<DomainEvent, 'id' | 'tenantId' | 'occurredAt'> & {
    occurredAt?: Date;
  },
): Promise<DomainEvent> {
  const full: DomainEvent = {
    id: randomUUID(),
    tenantId,
    type: event.type,
    contactId: event.contactId,
    accountId: event.accountId,
    source: event.source,
    payload: event.payload,
    occurredAt: event.occurredAt ?? new Date(),
  };

  // 1. Durable persistence (best-effort: log on failure but do not throw —
  //    callers treat emit() as non-blocking).
  try {
    const col = await getEventsCollection();
    const doc: EventDoc = { _id: full.id, ...stripId(full) };
    await col.insertOne(doc);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[data-fabric] failed to persist event:', err);
    }
  }

  // 2. In-process fan-out.
  emitter.emit('event', full);

  // 3. Redis pub/sub fan-out (skip locally if no REDIS_URL).
  const pub = getPublisher();
  if (pub) {
    void pub
      .publish(CHANNEL, JSON.stringify(full))
      .catch(() => {
        /* swallow — already logged via 'error' handler */
      });
  }

  return full;
}

/**
 * Subscribe to all data-fabric events. Returns an unsubscribe function.
 * Optionally filter by event type or tenantId.
 */
export function subscribe(
  handler: EventHandler,
  opts?: { type?: DomainEvent['type']; tenantId?: string },
): Unsubscribe {
  // Lazily attach the Redis subscriber so this works in standalone scripts.
  ensureSubscriber();

  const wrapped = async (event: DomainEvent) => {
    if (opts?.type && event.type !== opts.type) return;
    if (opts?.tenantId && event.tenantId !== opts.tenantId) return;
    try {
      await handler(event);
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[data-fabric] subscriber threw:', err);
      }
    }
  };
  emitter.on('event', wrapped);
  return () => {
    emitter.off('event', wrapped);
  };
}

/* ══════════════════════════════════════════════════════════
   Test-only helpers (kept on the public surface to avoid a
   parallel test entrypoint, but harmless in production).
   ══════════════════════════════════════════════════════════ */

/**
 * Drops all in-process listeners. Useful between tests; never call from
 * application code.
 */
export function _resetEmitterForTests(): void {
  emitter.removeAllListeners('event');
}

function stripId<T extends { id?: unknown }>(obj: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = obj;
  return rest;
}
