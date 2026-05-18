/**
 * SabFlow WS gateway — Yjs awareness (presence) diff broadcast.
 *
 * Track A · Phase 4 · #3 of 10.
 *
 * Awareness is the Yjs sibling protocol to sync: it carries ephemeral
 * per-client state (cursor, selection, user chrome) that should *not* be
 * persisted into the doc but should be live-replicated to peers in the room.
 *
 * This module is the room-side glue:
 *   1. Decode incoming awareness updates from one client, apply them to the
 *      room's awareness map, and broadcast the diff to peers (excluding
 *      sender).
 *   2. Produce the "initial state" frame for a newly-joined member so they
 *      see the existing peers' cursors without waiting for the next tick.
 *   3. GC stale entries whose `lastSeen` exceeds a TTL (default 30 s — see
 *      ADR §3.6 "Stale remote awareness on other peers ages out after 30 s").
 *   4. Synthesize a null-state update on member-leave so peers clear the
 *      departed cursors *immediately* (instead of waiting up to the GC TTL).
 *
 * Wire format (ADR §4.1):
 *   Outbound binary frame = `u8 tag (0x01) | yjs-awareness-payload`.
 *   This module hands `Buffer` frames to `room.broadcastAwareness(sender, frame)`
 *   already tag-prefixed.
 *
 * Forward declarations (per the sub-task constraint "no deps;
 * forward-decl AwarenessProtocol"):
 *   - `AwarenessProtocol` is the sibling Yjs codec — the real implementation
 *     (Phase 4 sub-task #5) wires `y-protocols/awareness` in via
 *     `setAwarenessProtocol(...)`. Until then a no-op stub is installed so
 *     this module can be loaded and unit-tested in isolation.
 *   - `RoomLike` mirrors the surface of `Room` from `../room.ts` that this
 *     file actually touches. Using a structural type means we never break
 *     when `Room` adds unrelated fields, and tests can supply a fake.
 *
 * Memory hygiene:
 *   - Per-room state (lastSeen + connection↔clientId map) is held in a
 *     `WeakMap` keyed by the room object so a removed room is collected
 *     automatically — no leak on RoomRegistry.remove().
 */

// ---------------------------------------------------------------------------
// Forward-declared types (no runtime imports).
// ---------------------------------------------------------------------------

/**
 * Structural subset of `Room` that this module touches. The real `Room`
 * (`../room.ts`) is a superset; we never widen this to the full type so
 * tests can pass a minimal fake.
 *
 * `RoomEventLike` is the discriminated union the real `RoomEvent` widens
 * — we only branch on `kind === 'leave'` inside `startAwarenessGc`. The
 * other variants are typed as `{ kind: ... }` rather than `unknown` so
 * the real `Room.on(RoomListener)` is structurally assignable to
 * `RoomLike.on(...)` under strict function-types (the listener parameter
 * is contravariant — our listener must accept at least every event the
 * real room emits).
 */
export interface RoomLike {
  readonly key: string;
  readonly awareness: Map<number, AwarenessStateLike>;
  broadcastAwareness(senderConnId: string | null, diff: Buffer): void;
  on(listener: (ev: RoomEventLike) => void): () => void;
}

/** Minimal awareness state shape. Mirrors `AwarenessState` in `../room.ts`. */
export interface AwarenessStateLike {
  clientId: number;
  userId: string;
  color: string;
  name: string;
  cursor?: unknown;
  selection?: unknown;
}

/** The `leave` event the room emits (see `RoomEvent` in `../room.ts`). */
export interface RoomLeaveLike {
  kind: 'leave';
  connectionId: string;
  userId: string;
  roomSize: number;
}

/**
 * Mirrors the `RoomEvent` discriminated union in `../room.ts`. We only
 * branch on `kind === 'leave'`; non-leave variants are deliberately typed
 * as a wide bag so the real (narrower) `RoomEvent` is a structural
 * subtype of `RoomEventLike` and a real `Room` can be passed where a
 * `RoomLike` is expected (the `on` listener parameter is contravariant
 * — our wide listener must accept every concrete event the real room
 * emits).
 */
export type RoomEventLike =
  | RoomLeaveLike
  | ({ kind: 'join' | 'empty' | 'rejoined' } & Record<string, unknown>);

/**
 * Forward-declared Yjs awareness codec surface. The real implementation is
 * `y-protocols/awareness` — wired up by Phase 4 sub-task #5 via
 * `setAwarenessProtocol(impl)`. We forward-decl rather than import so this
 * module has no npm dep of its own and can be unit-tested with a stub.
 */
export interface AwarenessProtocol {
  /**
   * Decode a binary awareness update and return the per-client state diff.
   * `null` state means "remove this client". The `clock` is the Yjs
   * awareness clock used for conflict resolution.
   */
  decodeUpdate(update: Uint8Array): ReadonlyArray<{
    clientId: number;
    clock: number;
    state: Record<string, unknown> | null;
  }>;
  /**
   * Encode a set of `(clientId, clock, state)` tuples into a single Yjs
   * awareness update binary payload. The room is responsible for prepending
   * the `0x01` tag before broadcast.
   */
  encodeUpdate(
    entries: ReadonlyArray<{
      clientId: number;
      clock: number;
      state: Record<string, unknown> | null;
    }>,
  ): Uint8Array;
}

// ---------------------------------------------------------------------------
// Protocol injection point (forward decl until sub-task #5 wires Yjs)
// ---------------------------------------------------------------------------

/**
 * No-op stub used until `setAwarenessProtocol()` is called with the real
 * `y-protocols/awareness` shim. Importantly it *does not throw* — that
 * would break Phase 3 unit tests that exercise the room without ever
 * touching the wire codec. Tests that need real decode supply their own.
 */
const STUB_PROTOCOL: AwarenessProtocol = {
  decodeUpdate: () => [],
  encodeUpdate: () => new Uint8Array(0),
};

let activeProtocol: AwarenessProtocol = STUB_PROTOCOL;

/**
 * Inject the real Yjs awareness codec. Called once at gateway boot by the
 * sync wiring module (Phase 4 sub-task #5). Idempotent — calling twice with
 * the same impl is harmless; calling with a *different* impl logs a warning
 * via `console.warn` (we keep no module-level logger to stay dep-free).
 */
export function setAwarenessProtocol(impl: AwarenessProtocol): void {
  if (activeProtocol !== STUB_PROTOCOL && activeProtocol !== impl) {
    // eslint-disable-next-line no-console
    console.warn('[sabflow-ws] setAwarenessProtocol called twice with different implementations');
  }
  activeProtocol = impl;
}

/** Reset to the stub. Test-only; production code should never call this. */
export function __resetAwarenessProtocolForTests(): void {
  activeProtocol = STUB_PROTOCOL;
}

// ---------------------------------------------------------------------------
// Per-room bookkeeping
// ---------------------------------------------------------------------------

interface PerRoomState {
  /** Yjs awareness clock per clientId (monotonic, last seen). */
  readonly clock: Map<number, number>;
  /** Last-seen wall-clock ms per clientId — drives `gcAwareness` TTL sweep. */
  readonly lastSeen: Map<number, number>;
  /**
   * connectionId → set of clientIds owned by that connection. One tab can
   * theoretically host multiple Yjs clients (stale restored doc); we track
   * all of them so `synthesizeLeaveFor()` clears every cursor on leave.
   */
  readonly connToClients: Map<string, Set<number>>;
}

const perRoom: WeakMap<RoomLike, PerRoomState> = new WeakMap();

function stateFor(room: RoomLike): PerRoomState {
  let s = perRoom.get(room);
  if (!s) {
    s = {
      clock: new Map(),
      lastSeen: new Map(),
      connToClients: new Map(),
    };
    perRoom.set(room, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Frame helpers
// ---------------------------------------------------------------------------

/** ADR §4.1 tag for awareness updates. */
export const AWARENESS_TAG = 0x01;

/** Prepend the awareness tag byte to a Yjs awareness payload. */
function frameWithTag(payload: Uint8Array): Buffer {
  const out = Buffer.allocUnsafe(payload.length + 1);
  out[0] = AWARENESS_TAG;
  // Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength) would
  // share memory; we copy to be safe against later mutation by the codec.
  out.set(payload, 1);
  return out;
}

/**
 * Merge a Yjs-decoded state object into the room's structured `AwarenessState`.
 * Yjs awareness state is an opaque `Record<string, unknown>` on the wire;
 * convention (set by the client SDK in Phase 5) uses these keys:
 *   - `user.name`, `user.color`, `cursor`, `selection`
 * Anything we don't recognize is dropped — the room cares about the chrome
 * for the seat list and cursor/selection for rendering, not raw flags.
 */
function projectAwareness(
  clientId: number,
  userId: string,
  state: Record<string, unknown>,
): AwarenessStateLike {
  const user = (state.user ?? {}) as Record<string, unknown>;
  return {
    clientId,
    userId,
    color: typeof user.color === 'string' ? user.color : '#888',
    name: typeof user.name === 'string' ? user.name : 'Anonymous',
    cursor: state.cursor,
    selection: state.selection,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Handle an inbound awareness update from one connection.
 *
 * 1. Decode via `AwarenessProtocol.decodeUpdate`.
 * 2. For each `(clientId, clock, state)`:
 *      - Skip if `clock` ≤ stored clock (out-of-order).
 *      - If `state === null` → drop the slot from `room.awareness`.
 *      - Else → upsert the projected `AwarenessStateLike`.
 *    Refresh `lastSeen` and bind the clientId to the sender's connection.
 * 3. Re-encode the *accepted* subset (skip out-of-order entries) so peers
 *    don't replay stale clocks, then broadcast tag-prefixed via
 *    `room.broadcastAwareness(sender, frame)`. The sender is excluded from
 *    fan-out because their local Yjs awareness already has the update.
 *
 * `senderUserId` is required so we can populate `AwarenessState.userId` —
 * the wire payload carries client state but no SabNode user identity.
 */
export function handleAwarenessUpdate(
  update: Uint8Array,
  room: RoomLike,
  sender: { connectionId: string; userId: string },
): void {
  const decoded = activeProtocol.decodeUpdate(update);
  if (decoded.length === 0) return;

  const s = stateFor(room);
  const now = Date.now();
  const accepted: Array<{
    clientId: number;
    clock: number;
    state: Record<string, unknown> | null;
  }> = [];

  let conns = s.connToClients.get(sender.connectionId);
  if (!conns) {
    conns = new Set();
    s.connToClients.set(sender.connectionId, conns);
  }

  for (const entry of decoded) {
    const prev = s.clock.get(entry.clientId) ?? -1;
    if (entry.clock <= prev) continue; // out-of-order, drop silently

    s.clock.set(entry.clientId, entry.clock);
    s.lastSeen.set(entry.clientId, now);
    accepted.push(entry);

    if (entry.state === null) {
      room.awareness.delete(entry.clientId);
      conns.delete(entry.clientId);
      // We deliberately leave `clock` in place so a late duplicate cannot
      // resurrect the slot at a stale clock value.
    } else {
      conns.add(entry.clientId);
      room.awareness.set(
        entry.clientId,
        projectAwareness(entry.clientId, sender.userId, entry.state),
      );
    }
  }

  if (accepted.length === 0) return;

  const payload = activeProtocol.encodeUpdate(accepted);
  if (payload.length === 0) return;
  room.broadcastAwareness(sender.connectionId, frameWithTag(payload));
}

/**
 * Build the awareness frame a brand-new member should receive immediately
 * after join — every current `(clientId, clock, state)` tuple in the room,
 * encoded as one Yjs awareness update with the `0x01` tag prefix.
 *
 * Returns an empty `Uint8Array` (zero length) if the room has no awareness
 * entries yet, so the caller can cheaply skip sending the frame.
 *
 * The caller (Phase 4 sub-task #5 connection handler) is expected to write
 * this to the *new* socket only — it must not be broadcast.
 */
export function awarenessInitialState(room: RoomLike): Uint8Array {
  if (room.awareness.size === 0) return new Uint8Array(0);

  const s = stateFor(room);
  const entries: Array<{
    clientId: number;
    clock: number;
    state: Record<string, unknown> | null;
  }> = [];

  for (const [clientId, st] of room.awareness) {
    entries.push({
      clientId,
      clock: s.clock.get(clientId) ?? 0,
      state: {
        user: { name: st.name, color: st.color },
        cursor: st.cursor,
        selection: st.selection,
      },
    });
  }

  const payload = activeProtocol.encodeUpdate(entries);
  if (payload.length === 0) return new Uint8Array(0);
  // Same shape as `handleAwarenessUpdate` — tag-prefix into a Buffer for
  // the socket layer. We return a `Uint8Array` (Buffer extends it) so the
  // signature stays runtime-neutral per the task contract.
  return frameWithTag(payload);
}

/**
 * Synthesize an awareness "null" update for a departed connection so peers
 * clear the cursor *now* instead of waiting up to `gcAwareness`'s TTL.
 *
 * Walks `connToClients[connectionId]`, bumps the clock for each owned
 * clientId, encodes one combined null-state update, and broadcasts it with
 * `senderConnId = null` so every remaining member receives it.
 *
 * Idempotent: a second call after the connection has already been cleaned
 * up is a no-op.
 */
export function synthesizeLeaveFor(room: RoomLike, connectionId: string): void {
  const s = stateFor(room);
  const owned = s.connToClients.get(connectionId);
  if (!owned || owned.size === 0) {
    s.connToClients.delete(connectionId);
    return;
  }

  const entries: Array<{
    clientId: number;
    clock: number;
    state: Record<string, unknown> | null;
  }> = [];

  for (const clientId of owned) {
    const next = (s.clock.get(clientId) ?? 0) + 1;
    s.clock.set(clientId, next);
    s.lastSeen.delete(clientId);
    room.awareness.delete(clientId);
    entries.push({ clientId, clock: next, state: null });
  }
  s.connToClients.delete(connectionId);

  if (entries.length === 0) return;
  const payload = activeProtocol.encodeUpdate(entries);
  if (payload.length === 0) return;
  // `senderConnId = null` so every remaining member receives the tombstones,
  // including the departed connection's *other* tabs (different connectionId,
  // same userId) which still hold the stale cursor in their local Yjs view.
  room.broadcastAwareness(null, frameWithTag(payload));
}

/**
 * Periodic sweep — remove awareness entries whose `lastSeen` is older than
 * `ttlMs`. Returns the count swept (useful for /metrics).
 *
 * Default 30 s matches ADR §3.6 "Stale remote awareness on other peers ages
 * out after 30 s". On sweep we broadcast a null-state update for each removed
 * clientId so peers don't have to run their own TTL — keeping a single source
 * of truth (the gateway) for presence age-out.
 */
export function gcAwareness(room: RoomLike, ttlMs = 30_000): number {
  const s = stateFor(room);
  if (s.lastSeen.size === 0) return 0;

  const cutoff = Date.now() - ttlMs;
  const tombstones: Array<{
    clientId: number;
    clock: number;
    state: Record<string, unknown> | null;
  }> = [];

  for (const [clientId, lastSeen] of s.lastSeen) {
    if (lastSeen > cutoff) continue;
    const next = (s.clock.get(clientId) ?? 0) + 1;
    s.clock.set(clientId, next);
    s.lastSeen.delete(clientId);
    room.awareness.delete(clientId);
    tombstones.push({ clientId, clock: next, state: null });
  }

  // Also drop the clientId from every connection's owned-set so a later
  // synthesizeLeaveFor doesn't re-emit a tombstone for the same client.
  if (tombstones.length > 0) {
    const removed = new Set(tombstones.map((t) => t.clientId));
    for (const owned of s.connToClients.values()) {
      for (const c of removed) owned.delete(c);
    }
  }

  if (tombstones.length === 0) return 0;
  const payload = activeProtocol.encodeUpdate(tombstones);
  if (payload.length > 0) {
    room.broadcastAwareness(null, frameWithTag(payload));
  }
  return tombstones.length;
}

/**
 * Stop handle returned by `startAwarenessGc`. Calling `.stop()` clears the
 * interval and detaches the `room.on('leave', ...)` synthesis listener.
 */
export interface AwarenessGcHandle {
  stop(): void;
}

/**
 * Arm the periodic GC sweep and the leave→synthesize wiring for a room.
 *
 * Behaviour:
 *   - `setInterval(gcAwareness, intervalMs)` — the interval is `.unref()`'d
 *     so an idle process can still exit cleanly.
 *   - `room.on(...)` subscribes to lifecycle events; on `leave` we call
 *     `synthesizeLeaveFor(room, connectionId)` so peers clear cursors
 *     within one network round-trip instead of up to `ttlMs`.
 *   - `.stop()` is idempotent.
 *
 * The caller (Phase 4 sub-task #5 / Phase 3 RoomRegistry hook) is expected
 * to call `startAwarenessGc` once per room creation and `.stop()` once on
 * room eviction.
 */
export function startAwarenessGc(
  room: RoomLike,
  intervalMs = 10_000,
  ttlMs = 30_000,
): AwarenessGcHandle {
  const timer: ReturnType<typeof setInterval> = setInterval(() => {
    try {
      gcAwareness(room, ttlMs);
    } catch {
      // GC must never crash the process — a malformed codec injection
      // would otherwise take the gateway down. The next tick retries.
    }
  }, intervalMs);
  const t = timer as unknown as { unref?: () => void };
  if (typeof t.unref === 'function') t.unref();

  const unsubscribe = room.on((ev: RoomEventLike) => {
    if (ev.kind !== 'leave') return;
    try {
      synthesizeLeaveFor(room, ev.connectionId);
    } catch {
      // Same rationale as the GC catch — never let a peer-clear failure
      // break room membership bookkeeping.
    }
  });

  let stopped = false;
  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      unsubscribe();
    },
  };
}

// ---------------------------------------------------------------------------
// Test-only introspection (named with `__` to flag non-public surface).
// ---------------------------------------------------------------------------

/** Read the per-room bookkeeping; tests only. */
export function __peekRoomState(room: RoomLike): {
  clock: ReadonlyMap<number, number>;
  lastSeen: ReadonlyMap<number, number>;
  connToClients: ReadonlyMap<string, ReadonlySet<number>>;
} {
  return stateFor(room);
}
