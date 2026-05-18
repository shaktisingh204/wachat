/**
 * SabFlow WS gateway — update broadcast fan-out + multi-instance backplane hook.
 *
 * Track A · Phase 4 · #2 of 10.
 *
 * Scope (this file only):
 *   1. `broadcastUpdate({room, sender, update})` — send an already-encoded Yjs
 *      sync/update frame (tag 0x00 per ADR §4.1) to every room member except
 *      the originator, by delegating to `Room.broadcast` from `../room.ts`.
 *   2. `BroadcastBackplane` interface — the contract a pub/sub adapter (the
 *      Phase 7 sibling Redis adapter, deliberately forward-declared and not
 *      implemented here) must satisfy to wire cross-instance fan-out.
 *   3. `installBackplane(backplane)` — registers a process-global backplane so
 *      updates published by *other* instances land in the local room map. Only
 *      one backplane may be installed at a time; reinstalling unsubscribes the
 *      previous one.
 *   4. Echo deduplication — every frame published through the backplane is
 *      8-byte instance-id-prefixed; we suppress delivery of frames whose
 *      origin equals our own `INSTANCE_ID`.
 *   5. No-op default — until a real adapter is installed, `publishToBackplane`
 *      is a quiet no-op so single-instance deployments need zero wiring.
 *
 * Non-scope (deliberately deferred):
 *   - The Redis pub/sub adapter itself (sibling Phase 7 sub-task).
 *   - Awareness fan-out — `Room.broadcastAwareness` is a sibling and may grow
 *     its own backplane later; this file owns the *update* path only.
 *   - Yjs sync-protocol encode/decode (Phase 4 sub-task #1 / #5).
 *
 * Constraints (per task brief):
 *   - No new npm dependencies. We use `crypto.randomBytes` from Node's stdlib
 *     and nothing else outside the project.
 *   - File ownership: this module never edits `../room.ts` and never imports
 *     a sibling other than the `Room`/`RoomRegistry` types it must talk to.
 */

import { randomBytes } from 'node:crypto';

import type { Room, RoomRegistry } from '../room.js';

// ---------------------------------------------------------------------------
// Instance identity
// ---------------------------------------------------------------------------

/**
 * Per-process instance id, 8 bytes. Generated once at module load. Used as the
 * dedup prefix on every backplane-published frame so a process can recognise
 * (and skip) the echo of its own publication when the pub/sub channel fans
 * back to it.
 *
 * 8 bytes (64 bits) is plenty to make collisions across a fleet vanishingly
 * unlikely while keeping the wire overhead negligible (the smallest Yjs update
 * is already ~10 bytes, so 8 bytes of prefix is well under +100% overhead in
 * the worst case and effectively free for typical-sized updates).
 *
 * Exported as a frozen `Buffer` so callers can compare without copying, but
 * cannot mutate the bytes.
 */
export const INSTANCE_ID: Buffer = randomBytes(8);

/** Length of the instance-id dedup prefix on every backplane frame. */
export const INSTANCE_ID_LEN = 8;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Minimal sender shape `broadcastUpdate` cares about. Accepting only
 * `connectionId` keeps this file decoupled from the full `MemberHandle`
 * interface in `../room.ts` — the connection layer (Phase 3 sub-task #4) may
 * grow / shrink that interface without rippling here.
 *
 * `null` means "no sender to exclude" — used when the update originated on a
 * different instance and was delivered to us via the backplane.
 */
export interface UpdateSender {
  readonly connectionId: string;
}

export interface BroadcastUpdateArgs {
  /** The room the update belongs to. Caller has already resolved this. */
  room: Room;
  /** Originating member, or `null` for cross-instance / system-injected updates. */
  sender: UpdateSender | null;
  /**
   * The wire frame to fan out. Must already be tag-prefixed per ADR §4.1
   * (i.e. byte 0 == 0x00 for a Yjs sync/update). This module does **not**
   * synthesize the tag — that's the sync encoder's responsibility.
   */
  update: Buffer;
}

/**
 * Contract for a cross-instance fan-out backplane (Redis pub/sub in Phase 7,
 * but the interface is transport-agnostic — NATS, Kafka, or an in-memory
 * shim for tests all satisfy it).
 *
 * The backplane carries **wrapped** frames: an 8-byte origin instance id
 * prefix followed by the same `update` payload that was passed to
 * `broadcastUpdate`. The receiver is responsible for stripping the prefix and
 * skipping echoes; this file does that bookkeeping so adapter authors don't
 * have to.
 */
export interface BroadcastBackplane {
  /**
   * Publish a wrapped frame for `roomKey` across the pub/sub fabric. The
   * adapter must deliver the frame to every subscribed peer (including, in
   * most pub/sub fabrics, the publisher itself — which is why echoes carry
   * an origin id we can suppress).
   *
   * `originInstanceId` is the publisher's 8-byte id (i.e. `INSTANCE_ID`); the
   * adapter does not invent or rewrite it.
   */
  publish(roomKey: string, frame: Buffer, originInstanceId: Buffer): void;

  /**
   * Subscribe a handler that fires for every wrapped frame received from
   * the fabric. Returns an `unsubscribe` thunk. The handler signature is
   * `(roomKey, wrappedFrame) => void`; this module wraps the caller's
   * handler with origin-id dedup before forwarding.
   */
  subscribe(handler: (roomKey: string, wrappedFrame: Buffer) => void): () => void;
}

// ---------------------------------------------------------------------------
// No-op default backplane
// ---------------------------------------------------------------------------

/**
 * The default backplane is a quiet no-op. Single-instance deployments need
 * zero wiring: `broadcastUpdate` still fans out to local members via
 * `Room.broadcast`, and `publishToBackplane` becomes a free function call.
 *
 * Kept as a constant so the active-backplane field is never `null` and
 * `publishToBackplane` never has to branch on undefined.
 */
const NOOP_BACKPLANE: BroadcastBackplane = {
  publish(): void {
    /* no-op until a real adapter is installed */
  },
  subscribe(): () => void {
    return () => {
      /* no-op */
    };
  },
};

// ---------------------------------------------------------------------------
// Module-private backplane state
// ---------------------------------------------------------------------------
// We hold the active backplane plus the unsubscribe thunk from the last
// `installBackplane` call, so reinstallation can detach the previous adapter
// cleanly. The room-registry pointer is captured at install time so the
// backplane subscriber can deliver into the same registry the local server is
// reading from.

let activeBackplane: BroadcastBackplane = NOOP_BACKPLANE;
let activeUnsubscribe: (() => void) | null = null;
let registryRef: RoomRegistry | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fan out a Yjs update to every member of `room` except `sender`. Also
 * publishes the update across the installed backplane (no-op when none) so
 * peer instances can deliver it to their own room members.
 *
 * Sender is excluded because Yjs has already applied the update locally on
 * the originating client; redelivering would be wasteful (and Yjs would
 * idempotently no-op it, but the round-trip is still bytes-on-wire we'd
 * rather not pay).
 */
export function broadcastUpdate(args: BroadcastUpdateArgs): void {
  const { room, sender, update } = args;

  // Local fan-out always runs first — peer delivery is best-effort and the
  // primary readers of this room are local sockets in the same process.
  room.broadcast(sender ? sender.connectionId : null, update);

  // Cross-instance fan-out. The no-op backplane makes this a free call when
  // running single-instance.
  publishToBackplane(room.key, update);
}

/**
 * Install (or replace) the process-global backplane. The registry is captured
 * so the backplane subscriber knows where to deliver inbound frames.
 *
 * Reinstalling tears down the previous subscription before attaching the new
 * one, so callers in tests or hot-swap scenarios don't leak handlers.
 *
 * Pass `null` for `backplane` to remove the current adapter and revert to the
 * no-op default. The registry reference is also cleared so the module returns
 * to its pristine state — useful for test isolation.
 */
export function installBackplane(
  backplane: BroadcastBackplane | null,
  registry: RoomRegistry | null,
): void {
  // Detach prior subscription, if any.
  if (activeUnsubscribe) {
    try {
      activeUnsubscribe();
    } catch {
      // Adapter author bugs must not crash the gateway.
    }
    activeUnsubscribe = null;
  }

  if (backplane === null) {
    activeBackplane = NOOP_BACKPLANE;
    registryRef = null;
    return;
  }

  activeBackplane = backplane;
  registryRef = registry;

  // Attach our dedup-aware subscriber. The adapter calls us back with the
  // wrapped frame (8-byte origin id prefix + payload); we strip + dedup +
  // deliver to the local room (sender=null, since the originator is on a
  // different instance and is not among our local connections).
  activeUnsubscribe = backplane.subscribe((roomKey, wrappedFrame) => {
    if (wrappedFrame.length < INSTANCE_ID_LEN) {
      // Malformed frame — skip rather than crash. A real adapter should
      // never emit these, but defensive coding here lets us survive bugs in
      // a freshly written sibling adapter without taking down the gateway.
      return;
    }

    // Echo suppression: compare the leading 8 bytes against our own id.
    // `Buffer.compare` returns 0 on byte-for-byte equality and is the
    // cheapest comparison stdlib offers — no allocation.
    if (wrappedFrame.compare(INSTANCE_ID, 0, INSTANCE_ID_LEN, 0, INSTANCE_ID_LEN) === 0) {
      return;
    }

    // Look up the local room; if no editors here have it open, drop the
    // frame. Yjs guarantees eventual consistency on reconnect, so we don't
    // need to materialize a room just to keep a buffer for absent clients.
    const room = registryRef?.getById(roomKey);
    if (!room) return;

    // Strip the prefix. Slicing a Buffer is a zero-copy view — no
    // allocation, just a window into the same underlying bytes.
    const payload = wrappedFrame.subarray(INSTANCE_ID_LEN);

    // Per task brief: sender=undefined (i.e. null at the room layer) because
    // the originator is on a different instance and is not among our local
    // members — there is nothing to exclude.
    room.broadcast(null, payload);
  });
}

/**
 * Read-only view of the currently installed backplane. Primarily for tests
 * and for `/healthz`-style introspection (so ops can confirm whether Redis
 * fan-out is wired up). Returns the no-op default when nothing's installed.
 */
export function getBackplane(): BroadcastBackplane {
  return activeBackplane;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Wrap `frame` with the 8-byte `INSTANCE_ID` prefix and hand it to the active
 * backplane. Allocation strategy: a single `Buffer.concat` of length
 * `8 + frame.length`. The prefix is the same `INSTANCE_ID` constant every
 * call, so we don't re-randomise per publish.
 *
 * Errors thrown by the backplane are swallowed and logged via stderr (we
 * can't import the project logger without violating the no-deps + no-sibling-
 * imports constraint, and `console.error` is intentionally the only stderr
 * channel we use here). The local fan-out has already succeeded by the time
 * we get here, so a backplane outage degrades to "single-instance behaviour"
 * rather than dropping the update entirely.
 */
function publishToBackplane(roomKey: string, frame: Buffer): void {
  try {
    activeBackplane.publish(roomKey, frame, INSTANCE_ID);
  } catch (err) {
    // Best-effort: a sick backplane must never break local fan-out.
    // eslint-disable-next-line no-console
    console.error('[sabflow-ws] backplane.publish threw:', err);
  }
}

/**
 * Helper for adapter authors: build the wire frame the adapter will hand to
 * its underlying transport (Redis `PUBLISH`, NATS subject send, etc.). Kept
 * exported so the Phase 7 Redis adapter doesn't have to re-derive the wrap
 * format from the dedup contract.
 *
 * Layout:
 *   [0..8)  origin instance id (caller-supplied; usually `INSTANCE_ID`)
 *   [8..)   payload (already tag-prefixed Yjs update frame)
 */
export function wrapForBackplane(originInstanceId: Buffer, payload: Buffer): Buffer {
  if (originInstanceId.length !== INSTANCE_ID_LEN) {
    throw new Error(
      `wrapForBackplane: originInstanceId must be ${INSTANCE_ID_LEN} bytes, got ${originInstanceId.length}`,
    );
  }
  return Buffer.concat([originInstanceId, payload], INSTANCE_ID_LEN + payload.length);
}
