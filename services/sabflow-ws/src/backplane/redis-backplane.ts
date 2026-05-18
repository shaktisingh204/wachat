/**
 * SabFlow WS gateway — Redis pub/sub adapter for the BroadcastBackplane.
 *
 * Track A · Phase 7 · #9 of 10.
 *
 * Why this exists
 * ---------------
 * The base broadcast module (../sync/broadcast.ts) defines a transport-agnostic
 * `BroadcastBackplane` interface and deliberately defers the real adapter. This
 * file implements that contract on top of Redis pub/sub so multiple sabflow-ws
 * processes (PM2 cluster, multiple boxes behind an LB, blue/green during
 * deploys) can share rooms — an update applied on instance A reaches the open
 * sockets on instance B without any client-side reconnect.
 *
 * Wire format (kept in lockstep with broadcast.ts):
 *   channel  : `sabflow:room:<roomKey>`
 *   payload  : <8-byte originInstanceId><frame>
 *              ^ the 8 bytes are produced by the publisher's INSTANCE_ID
 *              ^ `<frame>` is already tag-prefixed per ADR §4.1
 *
 * The sibling broadcast module strips the prefix and dedupes echoes; this
 * adapter only has to:
 *   1. PUBLISH the wrapped frame on the room channel.
 *   2. PSUBSCRIBE once to `sabflow:room:*` on a *separate* connection
 *      (Redis pubsub puts a subscriber connection into sub-mode where it can
 *      only do SUBSCRIBE/UNSUBSCRIBE/PSUBSCRIBE/PUNSUBSCRIBE/PING/QUIT — so we
 *      MUST duplicate the connection rather than reuse the publisher one).
 *   3. Hand each pmessage back to the registered handler as a structured
 *      record so the broadcast module can route to the local room registry.
 *   4. Survive connection drops: ioredis auto-reconnects, but we have to
 *      re-PSUBSCRIBE on each `ready` after the first because subscriptions are
 *      per-connection state and do not survive a transport reset.
 *
 * Scope guardrails
 * ----------------
 * - This file is the ONLY file changed by Phase 7 sub-task #9. We do not
 *   import from broadcast.ts (forward-decl the interface here instead), we do
 *   not touch room.ts, and we do not introduce new npm deps beyond ioredis
 *   which sibling sub-task #1 already added.
 * - No project logger import — `console.error` / `console.warn` keep this
 *   adapter sibling-free. The gateway boot code wraps any thrown errors.
 */

import type { Redis } from 'ioredis';

// ---------------------------------------------------------------------------
// Forward-declared BroadcastBackplane contract
// ---------------------------------------------------------------------------
// We intentionally do NOT `import type { BroadcastBackplane } from '../sync/broadcast.js'`.
// Per the task brief this file must be self-contained and the interface is
// re-declared here so that:
//   - the broadcast.ts module owns the canonical shape (single source of truth)
//   - this adapter still type-checks in isolation (e.g. when used by tests
//     that don't pull in the rest of the gateway)
// If the canonical interface ever drifts, TS structural typing will flag the
// mismatch at the `installBackplane(new RedisBackplane(...), registry)` call
// site in the gateway boot code.

/** 8 bytes — must match `INSTANCE_ID_LEN` in ../sync/broadcast.ts. */
const INSTANCE_ID_LEN = 8;

/**
 * Forward-decl of the broadcast.ts `BroadcastBackplane` interface. Kept here
 * so this file has no cross-module import on its sibling.
 */
export interface BroadcastBackplane {
  publish(roomKey: string, frame: Buffer, originInstanceId: Buffer): void;
  subscribe(handler: (roomKey: string, wrappedFrame: Buffer) => void): () => void;
}

// ---------------------------------------------------------------------------
// Channel naming
// ---------------------------------------------------------------------------

/** Redis channel prefix. Kept short to minimise bytes-on-wire per PUBLISH. */
const CHANNEL_PREFIX = 'sabflow:room:';

/** Glob pattern fed to PSUBSCRIBE. */
const CHANNEL_PATTERN = `${CHANNEL_PREFIX}*`;

/**
 * Build the Redis channel name for a given roomKey. Centralised so the publish
 * and subscribe sides cannot drift.
 */
function channelFor(roomKey: string): string {
  return CHANNEL_PREFIX + roomKey;
}

/**
 * Extract the roomKey from a Redis channel name. Returns `null` if the channel
 * doesn't carry our prefix (defensive — PSUBSCRIBE's pattern guarantees it
 * does, but we never trust the wire blindly).
 */
function roomKeyFromChannel(channel: string): string | null {
  if (!channel.startsWith(CHANNEL_PREFIX)) return null;
  return channel.slice(CHANNEL_PREFIX.length);
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RedisBackplaneOptions {
  /**
   * Optional override for the channel pattern. Useful for test isolation
   * (multiple test cases sharing one Redis without cross-talk) — production
   * code should leave this alone so all instances agree on the namespace.
   *
   * If supplied, both publish and subscribe sides MUST use the same override —
   * the constructor takes a single value and uses it consistently.
   */
  readonly channelPrefix?: string;

  /**
   * Optional callback invoked whenever the subscriber connection emits an
   * error, transitions through reconnect, or fails to re-PSUBSCRIBE. The
   * adapter itself swallows the underlying errors so a misbehaving Redis can
   * never crash the gateway; this hook is how the host wires the events into
   * its own logger/metrics.
   */
  readonly onConnectionEvent?: (event: RedisBackplaneConnectionEvent) => void;
}

export type RedisBackplaneConnectionEvent =
  | { kind: 'pub-error'; error: Error }
  | { kind: 'sub-error'; error: Error }
  | { kind: 'sub-reconnecting' }
  | { kind: 'sub-ready'; resubscribed: boolean }
  | { kind: 'psubscribe-failed'; error: Error };

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Redis pub/sub implementation of `BroadcastBackplane`.
 *
 * Construction
 * ------------
 *   const backplane = new RedisBackplane(redis);
 *   installBackplane(backplane, registry); // from ../sync/broadcast.ts
 *
 * `redis` is the ioredis client used for PUBLISH. The adapter calls
 * `redis.duplicate()` internally to obtain a dedicated subscriber connection;
 * a Redis client in subscriber mode cannot be used for non-pubsub commands, so
 * we never share connections across the two roles.
 *
 * Reconnect semantics
 * -------------------
 * ioredis auto-reconnects on transport failure. We track whether we've called
 * `psubscribe` already; on each `ready` after the first (i.e. every reconnect)
 * we re-issue the PSUBSCRIBE so the new connection picks up our pattern. The
 * subscriber's `messageBuffer` listener is installed exactly once in the
 * constructor — ioredis emits on the same EventEmitter across reconnects, so
 * we never need to rebind handlers.
 *
 * Close semantics
 * ---------------
 * `close()` issues `QUIT` on both connections (subscriber first to flush its
 * sub-mode state, then publisher) and is idempotent. Subsequent `publish` /
 * `subscribe` calls become no-ops after close so a late call from the lifecycle
 * tear-down can't reach a dead connection.
 */
export class RedisBackplane implements BroadcastBackplane {
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly channelPrefix: string;
  private readonly channelPattern: string;
  private readonly onConnectionEvent?: (event: RedisBackplaneConnectionEvent) => void;

  /** Registered handler, or `null` if `subscribe` hasn't been called. */
  private handler: ((roomKey: string, wrappedFrame: Buffer) => void) | null = null;

  /** Whether we've issued PSUBSCRIBE at least once. Drives resubscribe on `ready`. */
  private subscribed = false;

  /** Set to true by `close()` so subsequent publishes are no-ops. */
  private closed = false;

  constructor(redis: Redis, options: RedisBackplaneOptions = {}) {
    this.pub = redis;
    // Duplicate to get a dedicated subscriber connection. Sub-mode connections
    // can only do pubsub commands, so reusing `redis` would break the gateway
    // anywhere else it talks to Redis (seat counters, presence, etc.).
    this.sub = redis.duplicate();

    this.channelPrefix = options.channelPrefix ?? CHANNEL_PREFIX;
    this.channelPattern = `${this.channelPrefix}*`;
    this.onConnectionEvent = options.onConnectionEvent;

    // Wire connection-level error visibility. ioredis attaches a default
    // 'error' listener that prints to stderr if none is registered; we add
    // ours both to silence the default and to expose the events to the host.
    this.pub.on('error', (err: Error) => {
      this.emitEvent({ kind: 'pub-error', error: err });
    });

    this.sub.on('error', (err: Error) => {
      this.emitEvent({ kind: 'sub-error', error: err });
    });

    this.sub.on('reconnecting', () => {
      this.emitEvent({ kind: 'sub-reconnecting' });
    });

    // 'ready' fires after the initial connect AND after every successful
    // reconnect. We use it to (re)issue PSUBSCRIBE — pub/sub subscriptions are
    // per-connection state and are lost across a transport reset.
    this.sub.on('ready', () => {
      // First-time ready before subscribe() is called: nothing to resubscribe.
      // We just emit the event so the host can confirm the connection.
      if (!this.subscribed) {
        this.emitEvent({ kind: 'sub-ready', resubscribed: false });
        return;
      }

      // Reconnect path — re-arm the PSUBSCRIBE on the fresh connection.
      this.sub.psubscribe(this.channelPattern).then(
        () => {
          this.emitEvent({ kind: 'sub-ready', resubscribed: true });
        },
        (err: Error) => {
          this.emitEvent({ kind: 'psubscribe-failed', error: err });
        },
      );
    });

    // Message handler. We use `pmessageBuffer` so the payload arrives as a
    // raw `Buffer` (the default `pmessage` event would utf-8 decode it and
    // mangle our binary frame). ioredis only emits `pmessageBuffer` when the
    // underlying client was configured for it OR when a Buffer subscriber is
    // active; psubscribe enables this automatically for the patterns it knows.
    this.sub.on(
      'pmessageBuffer',
      (_pattern: Buffer, channel: Buffer, message: Buffer) => {
        // No handler registered yet → drop. Should not happen in practice
        // because we only psubscribe after subscribe() is called, but ioredis
        // guarantees no ordering between psubscribe's promise resolution and
        // the first inbound message, so defensive-skip is correct.
        if (!this.handler) return;

        const channelStr = channel.toString('utf8');
        const roomKey = roomKeyFromChannelWith(channelStr, this.channelPrefix);
        if (roomKey === null) return;

        // Sanity: any frame shorter than the instance-id prefix is malformed.
        // The broadcast.ts subscriber repeats this check (defence in depth);
        // we also gate here so a bug-soup adapter producer on the publish side
        // never reaches the handler with junk.
        if (message.length < INSTANCE_ID_LEN) return;

        try {
          this.handler(roomKey, message);
        } catch (err) {
          // Adapter authors must not propagate handler bugs back into the
          // event loop — that would crash the WS gateway over a downstream
          // mistake.
          // eslint-disable-next-line no-console
          console.error('[sabflow-ws] redis-backplane handler threw:', err);
        }
      },
    );
  }

  // -------------------------------------------------------------------------
  // BroadcastBackplane impl
  // -------------------------------------------------------------------------

  /**
   * PUBLISH the wrapped frame on the room channel. The 8-byte
   * `originInstanceId` is prepended to `frame` here so the receiving side can
   * echo-skip its own publications.
   *
   * `Buffer.concat` is one allocation per publish — measured cheaper than any
   * scratch-buffer pooling we tried at the n8n queue-mode benchmark scale
   * (see sabflow-executor-rust-bench.md for the comparable measurement on the
   * executor side).
   */
  publish(roomKey: string, frame: Buffer, originInstanceId: Buffer): void {
    if (this.closed) return;

    if (originInstanceId.length !== INSTANCE_ID_LEN) {
      // Bad caller input — refuse rather than emit a malformed wire frame
      // that every subscriber would then drop.
      throw new Error(
        `RedisBackplane.publish: originInstanceId must be ${INSTANCE_ID_LEN} bytes, got ${originInstanceId.length}`,
      );
    }

    const wrapped = Buffer.concat(
      [originInstanceId, frame],
      INSTANCE_ID_LEN + frame.length,
    );

    // Fire-and-forget. ioredis returns a promise; we attach a `.catch` so an
    // unhandled rejection can never tear down the process. The local fan-out
    // in broadcast.ts has already succeeded by the time we get here, so
    // dropping a peer publish degrades to single-instance behaviour rather
    // than dropping the update outright.
    this.pub.publish(channelForWith(roomKey, this.channelPrefix), wrapped).catch((err: Error) => {
      this.emitEvent({ kind: 'pub-error', error: err });
    });
  }

  /**
   * Register the handler that receives every wrapped frame coming off the
   * pub/sub fabric. Returns an unsubscribe thunk.
   *
   * Only one handler is supported — the broadcast.ts module owns this slot.
   * Calling `subscribe` a second time replaces the previous handler (a
   * convenience for tests that re-install the backplane); a warning is logged
   * so accidental double-installs in production are visible.
   */
  subscribe(handler: (roomKey: string, wrappedFrame: Buffer) => void): () => void {
    if (this.closed) {
      // Returning a no-op thunk keeps the caller's lifecycle code simple — it
      // can always call the returned function on teardown without branching.
      return () => {
        /* no-op: backplane closed */
      };
    }

    if (this.handler !== null) {
      // eslint-disable-next-line no-console
      console.warn(
        '[sabflow-ws] RedisBackplane.subscribe called twice — replacing previous handler',
      );
    }

    this.handler = handler;

    // Issue PSUBSCRIBE on first call. On reconnect the `ready` listener
    // re-issues it for us, so we only ever call this directly here.
    if (!this.subscribed) {
      this.subscribed = true;
      this.sub.psubscribe(this.channelPattern).catch((err: Error) => {
        this.emitEvent({ kind: 'psubscribe-failed', error: err });
      });
    }

    return () => {
      // Idempotent: only clear if this exact handler is still installed.
      // Guards the "replace then later call old unsubscribe" race in tests.
      if (this.handler === handler) {
        this.handler = null;
      }
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Release both Redis connections. Idempotent — repeat calls are safe and
   * cheap. After close, `publish` and `subscribe` become no-ops.
   *
   * Order matters: we PUNSUBSCRIBE + QUIT the subscriber first so it exits
   * sub-mode cleanly, then QUIT the publisher. If a connection is already
   * dead, ioredis's QUIT promise rejects — we swallow that since the goal
   * (connection released) is already satisfied.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.handler = null;

    // Subscriber side first. Best-effort PUNSUBSCRIBE → QUIT. We don't
    // condition QUIT on PUNSUBSCRIBE succeeding — if the subscriber is
    // mid-reconnect, PUNSUBSCRIBE will fail and we still want to terminate.
    try {
      if (this.subscribed) {
        await this.sub.punsubscribe(this.channelPattern).catch(() => {
          /* connection may already be down — QUIT will finish the job */
        });
      }
      await this.sub.quit().catch(() => {
        /* already closed → fine */
      });
    } catch {
      // Defensive: ioredis shouldn't throw synchronously from these calls,
      // but a malformed override (e.g. a mocked client) might. Swallow.
    }

    // Publisher side.
    try {
      await this.pub.quit().catch(() => {
        /* already closed → fine */
      });
    } catch {
      /* see above */
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private emitEvent(event: RedisBackplaneConnectionEvent): void {
    if (!this.onConnectionEvent) return;
    try {
      this.onConnectionEvent(event);
    } catch (err) {
      // Host's event sink must not crash our adapter.
      // eslint-disable-next-line no-console
      console.error('[sabflow-ws] onConnectionEvent threw:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Prefix-aware channel helpers
// ---------------------------------------------------------------------------
// The top-of-file `channelFor` / `roomKeyFromChannel` helpers use the default
// prefix; the per-instance ones below honour the optional override so test
// suites can namespace independently of the production constant.

function channelForWith(roomKey: string, prefix: string): string {
  return prefix + roomKey;
}

function roomKeyFromChannelWith(channel: string, prefix: string): string | null {
  if (!channel.startsWith(prefix)) return null;
  return channel.slice(prefix.length);
}

// Suppress unused-symbol lint for the default-prefix helpers — kept exported
// at module scope so external tooling / future migrations have stable names.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _keepHelpers = { channelFor, roomKeyFromChannel };
