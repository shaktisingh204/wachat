/**
 * Redis pub/sub helpers for SabWa real-time events.
 *
 * Mirrors `services/sabwa-engine/src/realtime/pubsub.rs`. All real-time
 * fan-out goes through Redis on the channel `sabwa:{sessionId}:events`
 * (see `SABWA_PLAN.md` §5).
 *
 * - {@link publish} is called by the Baileys worker whenever an event
 *   should be forwarded to subscribed clients (browsers via SSE).
 * - {@link subscribe} is called by the SSE handler to consume those
 *   events. It opens a *dedicated* Redis subscriber connection so the
 *   sub never interferes with normal command traffic, and tears the
 *   connection down when the caller aborts the supplied `AbortSignal`.
 *
 * Event payload shape (matches the Rust enum tagged with `kind`):
 *
 * ```json
 * { "kind": "qr",         "sessionId": "...", "qr": "2@..." }
 * { "kind": "pair_code",  "sessionId": "...", "code": "JKLM-NPQR" }
 * { "kind": "status",     "sessionId": "...", "status": "connected" }
 * { "kind": "message",    "sessionId": "...", ...payload }
 * ```
 *
 * Malformed payloads are logged and dropped — one bad publisher must not
 * be able to kill an active subscriber.
 */

import { createClient, type RedisClientType } from 'redis';
import type { Logger } from '../log.js';
import type { RedisHandles } from '../db/redis.js';

/** Build the Redis pub/sub channel name for a given session. */
export function channelName(sessionId: string): string {
  return `sabwa:${sessionId}:events`;
}

/**
 * Minimal contract for a SabWa real-time event. Variants are extensible
 * — any object with a `kind` discriminator round-trips through pub/sub.
 */
export interface SabwaEvent {
  /**
   * Internal discriminator. Known values: `message`, `message_status`,
   * `chat`, `presence`, `typing`, `qr`, `pair_code`, `status`,
   * `scheduled`. Forward-compatible: unknown kinds are forwarded verbatim
   * so future event types do not require an SSE bridge change.
   */
  kind: string;
  sessionId?: string;
  /** Arbitrary extra fields specific to the event kind. */
  [extra: string]: unknown;
}

/**
 * Publish a [`SabwaEvent`] to the session's Redis channel.
 *
 * The function awaits Redis's PUBLISH ack but does *not* wait for any
 * subscriber to actually receive — Redis pub/sub is fire-and-forget.
 */
export async function publish(
  redis: RedisHandles,
  sessionId: string,
  event: SabwaEvent,
): Promise<void> {
  const channel = channelName(sessionId);
  const payload = JSON.stringify(event);
  await redis.pub.publish(channel, payload);
}

/**
 * Subscribe to a session's Redis channel and forward parsed events to
 * `onEvent`. The subscription is closed when `signal` aborts (or the
 * returned `unsubscribe` is called).
 *
 * Each call opens its OWN duplicate Redis connection (node-redis
 * requires subscribers be isolated from regular command traffic). This
 * keeps one SSE client per Redis pubsub connection — perfectly fine for
 * the order of magnitude we serve and trivially correct.
 */
export async function subscribe(
  redis: RedisHandles,
  sessionId: string,
  onEvent: (event: SabwaEvent) => void,
  signal: AbortSignal,
  log?: Logger,
): Promise<() => Promise<void>> {
  const channel = channelName(sessionId);

  // `duplicate()` reuses the URL+options from the publisher connection so
  // we don't have to thread the redis URL down here separately.
  const sub: RedisClientType = redis.pub.duplicate() as RedisClientType;
  sub.on('error', (err) => {
    log?.warn({ err, channel }, 'redis subscriber error');
  });
  await sub.connect();

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await sub.unsubscribe(channel);
    } catch (err) {
      log?.debug({ err, channel }, 'unsubscribe failed (likely already closed)');
    }
    try {
      await sub.quit();
    } catch (err) {
      log?.debug({ err, channel }, 'subscriber quit failed (likely already closed)');
    }
  };

  await sub.subscribe(channel, (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      log?.warn({ err, channel, bytes: raw.length }, 'dropping malformed SabwaEvent payload');
      return;
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as { kind?: unknown }).kind !== 'string'
    ) {
      log?.warn({ channel }, 'dropping event with missing/non-string kind');
      return;
    }
    onEvent(parsed as SabwaEvent);
  });

  // Allow callers to bail via AbortSignal — wired by the SSE handler to
  // the client's `req` close event.
  if (signal.aborted) {
    await close();
  } else {
    const onAbort = (): void => {
      void close();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  }

  return close;
}

/**
 * Standalone factory: open a dedicated Redis subscriber from a URL.
 *
 * Exported so tests or one-off scripts can subscribe without instantiating
 * the full `RedisHandles` triple.
 */
export async function buildSubscriberFromUrl(
  url: string,
  log?: Logger,
): Promise<RedisClientType> {
  const c: RedisClientType = createClient({ url });
  c.on('error', (err) => {
    log?.warn({ err }, 'standalone subscriber error');
  });
  await c.connect();
  return c;
}
