/**
 * SabFlow WS gateway — in-memory room model.
 *
 * One doc = one room. Keyed by `${workspaceId}:${docId}`.
 *
 * This module is **transport-agnostic**: it never imports a sibling file and
 * never touches the underlying WebSocket. Callers (the connection handler in
 * Phase 3 sub-task #4) hand the room a `MemberHandle` that knows how to write
 * to its own socket, and the room is responsible only for fan-out and
 * membership bookkeeping.
 *
 * Persistence is intentionally out of scope here — see
 * `docs/adr/sabflow-persistence.md` (Phase A.2). Rooms are pure in-process
 * state; on instance crash the room is rebuilt lazily when the first client
 * rejoins.
 *
 * Memory hygiene: when the last member leaves, the room arms a 60 s eviction
 * timer. If a member rejoins before it fires, the timer is cancelled. The
 * registry consults `Room.isEmpty()` + `Room.evictionScheduledAt` so the
 * outer server loop can call `RoomRegistry.remove(key)` from the timer
 * callback.
 *
 * Scope of this sub-task (Track A · Phase 3 · #3 of 10):
 * - `Room` class with members, awareness, broadcast, broadcastAwareness,
 *   join, leave, isEmpty.
 * - `RoomRegistry` with getOrCreate / getById / remove / forEach.
 * - Idle-eviction timer (60 s, cancellable on rejoin).
 *
 * Out of scope (other sub-tasks):
 * - Yjs sync-protocol decode/encode — sub-task #5.
 * - Seat enforcement — sub-task #7.
 * - Redis fan-out for multi-instance — Phase 7.
 */

// ---------------------------------------------------------------------------
// Inline interfaces (no sibling imports).
// ---------------------------------------------------------------------------

/**
 * Opaque handle the connection layer hands to the room. The room must not
 * peek at the underlying socket; it only knows how to write through these
 * three methods.
 */
export interface MemberHandle {
  /** Stable per-connection id (the n8n-style `pushRef` from the upgrade URL). */
  readonly connectionId: string;
  /** Authenticated SabNode user id (after JWT-or-cookie auth on upgrade). */
  readonly userId: string;
  /** Authenticated workspace id; must match the room's workspaceId. */
  readonly workspaceId: string;
  /** Write a binary frame (already tag-prefixed per ADR §4.1). */
  send(frame: Buffer): void;
  /** Write a JSON control-plane frame as a text WS frame. */
  sendText(json: string): void;
  /** Close the underlying socket with one of the 4xxx codes from ADR §3.6. */
  close(code: number, reason?: string): void;
}

/**
 * Yjs-awareness-shaped local state for one editor tab. Mirrors the fields
 * Yjs's `Awareness` protocol carries in its `states` map. The room stores
 * these so a new joiner can be sent the current awareness set without
 * round-tripping Yjs decode here (decoding is sub-task #5).
 */
export interface AwarenessState {
  /** Yjs `clientID` (numeric, generated client-side; not the connectionId). */
  clientId: number;
  userId: string;
  /** User-chrome from the `presence.chrome` control message (ADR §4.2). */
  color: string;
  name: string;
  /** Optional cursor position; shape is editor-defined and opaque here. */
  cursor?: unknown;
  /** Optional selection range; shape is editor-defined and opaque here. */
  selection?: unknown;
}

/** Lifecycle events the room emits to whoever subscribes via `on*`. */
export type RoomEvent =
  | { kind: 'join'; member: MemberHandle; roomSize: number }
  | { kind: 'leave'; connectionId: string; userId: string; roomSize: number }
  | { kind: 'empty'; key: string }
  | { kind: 'rejoined'; key: string };

export type RoomListener = (ev: RoomEvent) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long a room stays alive after its last member leaves. */
export const ROOM_IDLE_EVICTION_MS = 60_000;

/** Build the canonical room key. */
export function roomKey(workspaceId: string, docId: string): string {
  return `${workspaceId}:${docId}`;
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

export class Room {
  readonly key: string;
  readonly workspaceId: string;
  readonly docId: string;
  readonly createdAt: number;

  readonly members: Map<string, MemberHandle> = new Map();
  readonly awareness: Map<number, AwarenessState> = new Map();

  lastActivityAt: number;

  /**
   * Timestamp at which the eviction timer was armed (0 when not armed). The
   * outer registry uses this to decide whether `remove(key)` should still
   * fire when the timer expires (a rejoin clears it).
   */
  evictionScheduledAt = 0;

  private evictionTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners: Set<RoomListener> = new Set();

  constructor(workspaceId: string, docId: string) {
    this.workspaceId = workspaceId;
    this.docId = docId;
    this.key = roomKey(workspaceId, docId);
    this.createdAt = Date.now();
    this.lastActivityAt = this.createdAt;
  }

  // -- Membership ----------------------------------------------------------

  join(member: MemberHandle): void {
    if (member.workspaceId !== this.workspaceId) {
      // Defensive: caller must enforce this before calling join, but if a
      // misrouted member sneaks in we refuse rather than silently leak
      // cross-workspace awareness.
      throw new Error(
        `Room.join: workspace mismatch (room=${this.workspaceId}, member=${member.workspaceId})`,
      );
    }

    const wasEmpty = this.members.size === 0;
    this.members.set(member.connectionId, member);
    this.lastActivityAt = Date.now();

    if (wasEmpty && this.evictionTimer !== null) {
      this.cancelEviction();
      this.emit({ kind: 'rejoined', key: this.key });
    }

    this.emit({ kind: 'join', member, roomSize: this.members.size });
  }

  leave(connectionId: string): void {
    const member = this.members.get(connectionId);
    if (!member) return;

    this.members.delete(connectionId);
    this.lastActivityAt = Date.now();

    // Drop any awareness slots this connection owned. A connection may hold
    // multiple Yjs clientIDs in pathological cases (tab restored a stale
    // doc); we scan and remove all of them keyed by userId+connection link.
    // Since AwarenessState carries `userId` and the connection→clientId
    // mapping is owned by the sync layer (sub-task #5), we leave actual
    // pruning of `awareness` to whoever called `leave`. For now we only
    // drop entries whose userId matches AND no other member with the same
    // userId remains.
    let userStillPresent = false;
    for (const m of this.members.values()) {
      if (m.userId === member.userId) {
        userStillPresent = true;
        break;
      }
    }
    if (!userStillPresent) {
      for (const [clientId, state] of this.awareness) {
        if (state.userId === member.userId) {
          this.awareness.delete(clientId);
        }
      }
    }

    this.emit({
      kind: 'leave',
      connectionId,
      userId: member.userId,
      roomSize: this.members.size,
    });

    if (this.members.size === 0) {
      this.emit({ kind: 'empty', key: this.key });
    }
  }

  isEmpty(): boolean {
    return this.members.size === 0;
  }

  // -- Broadcast -----------------------------------------------------------

  /**
   * Fan out a binary frame (already tag-prefixed; see ADR §4.1) to every
   * member except `senderConnId`. The sender is excluded because Yjs sync
   * + awareness updates are already locally applied on the sender's
   * client.
   */
  broadcast(senderConnId: string | null, frame: Buffer): void {
    this.lastActivityAt = Date.now();
    for (const [connId, member] of this.members) {
      if (connId === senderConnId) continue;
      try {
        member.send(frame);
      } catch {
        // Per ADR §5, backpressure strategy is "shed not buffer": if a
        // member's send throws we close it and let it reconnect. We must
        // not let one slow socket poison the fan-out loop.
        this.safeClose(member, 4500, 'send-failed');
      }
    }
  }

  /**
   * Same as `broadcast` but reserved for awareness frames (tag 0x01 per
   * ADR §4.1). Kept as a separate method so future Phase 7 work can route
   * awareness over a different transport (Redis pub/sub) without touching
   * sync broadcast.
   */
  broadcastAwareness(senderConnId: string | null, diff: Buffer): void {
    this.lastActivityAt = Date.now();
    for (const [connId, member] of this.members) {
      if (connId === senderConnId) continue;
      try {
        member.send(diff);
      } catch {
        this.safeClose(member, 4500, 'awareness-send-failed');
      }
    }
  }

  // -- Eviction ------------------------------------------------------------

  /**
   * Arm the idle-eviction timer. Called by the registry (not internally)
   * after observing the `empty` event, so the registry can hold the timer
   * callback and run `remove(key)` itself.
   */
  scheduleEviction(onElapsed: () => void): void {
    if (this.evictionTimer !== null) return;
    this.evictionScheduledAt = Date.now();
    this.evictionTimer = setTimeout(() => {
      this.evictionTimer = null;
      this.evictionScheduledAt = 0;
      if (this.isEmpty()) onElapsed();
    }, ROOM_IDLE_EVICTION_MS);
    // Don't keep the Node process alive solely because of an idle room.
    const t = this.evictionTimer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }

  cancelEviction(): void {
    if (this.evictionTimer === null) return;
    clearTimeout(this.evictionTimer);
    this.evictionTimer = null;
    this.evictionScheduledAt = 0;
  }

  // -- Events --------------------------------------------------------------

  on(listener: RoomListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(ev: RoomEvent): void {
    for (const l of this.listeners) {
      try {
        l(ev);
      } catch {
        // Listener faults must not break membership bookkeeping.
      }
    }
  }

  private safeClose(member: MemberHandle, code: number, reason: string): void {
    try {
      member.close(code, reason);
    } catch {
      /* already gone */
    }
    this.members.delete(member.connectionId);
  }
}

// ---------------------------------------------------------------------------
// RoomRegistry
// ---------------------------------------------------------------------------

export class RoomRegistry {
  private readonly rooms: Map<string, Room> = new Map();
  private readonly listeners: Set<RoomListener> = new Set();

  getOrCreate(workspaceId: string, docId: string): Room {
    const key = roomKey(workspaceId, docId);
    let room = this.rooms.get(key);
    if (room) return room;

    room = new Room(workspaceId, docId);
    this.rooms.set(key, room);

    // Wire room events into the registry-level fan-out and the eviction
    // bookkeeping. When the room reports `empty`, arm the 60 s timer; the
    // timer callback is `remove(key)` so callers can subscribe to a single
    // `kind: 'empty'` followed (60 s later, absent rejoin) by `remove`.
    room.on((ev) => {
      this.fanout(ev);
      if (ev.kind === 'empty') {
        const r = this.rooms.get(ev.key);
        if (r) {
          r.scheduleEviction(() => this.remove(ev.key));
        }
      }
    });

    return room;
  }

  getById(key: string): Room | undefined {
    return this.rooms.get(key);
  }

  /**
   * Drop the room. Caller is responsible for ensuring it's empty (or for
   * accepting that any remaining members will be orphaned — only the
   * eviction timer should normally reach this path).
   */
  remove(key: string): void {
    const room = this.rooms.get(key);
    if (!room) return;
    room.cancelEviction();
    this.rooms.delete(key);
  }

  forEach(fn: (room: Room, key: string) => void): void {
    for (const [key, room] of this.rooms) fn(room, key);
  }

  /** Number of live rooms (for /healthz + metrics). */
  size(): number {
    return this.rooms.size;
  }

  /**
   * Subscribe to events from every room in the registry. Returns an
   * unsubscribe function. Listeners added after `getOrCreate` still
   * receive that room's events because the registry attaches its own
   * listener on creation.
   */
  on(listener: RoomListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private fanout(ev: RoomEvent): void {
    for (const l of this.listeners) {
      try {
        l(ev);
      } catch {
        /* swallow */
      }
    }
  }
}
