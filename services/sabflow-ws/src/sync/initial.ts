/**
 * SabFlow WS gateway — initial sync (Yjs 3-step handshake).
 *
 * Track A · Phase 4 · sub-task #1 of 10.
 *
 * Implements the *server* side of Yjs's classic three-step sync protocol on
 * top of the binary framing fixed by
 * `docs/adr/sabflow-ws-gateway-node.md` §4.1:
 *
 *     +---------+---------+----------------------------------+
 *     | u8 0x00 | u8 sub  | yjs payload (state-vector or     |
 *     | tag     | tag     | encoded update bytes)            |
 *     +---------+---------+----------------------------------+
 *
 *   tag      0x00  yjs sync          (per ADR §4.1 frame tag table)
 *   sub-tag  0x00  sync-step-1       (server -> client: server state vector)
 *            0x01  sync-step-2       (server -> client: diff vs remote SV;
 *                                     also accepted from client during
 *                                     the second leg of the handshake)
 *            0x02  update            (client -> any: incremental update;
 *                                     also re-broadcast server -> peers)
 *
 * The three exported helpers are all that this sub-task owns. They are pure
 * functions over forward-declared sibling types (no runtime imports):
 *
 *   1. `initialSyncStep1(...)`     — server emits its current state-vector
 *      to a freshly-joined client.
 *   2. `handleSyncStep2(...)`      — server responds to a client-supplied
 *      state-vector with the missing update bytes (snapshot baseline +
 *      replayed oplog tail, diffed against the remote SV).
 *   3. `handleSyncUpdate(...)`     — server applies a client-emitted
 *      incremental update: validate, broadcast to peers, persist via the
 *      repo's append-only oplog path.
 *
 * SCOPE: this file ONLY. Every collaborator is a sibling sub-task and is
 * forward-declared here via `import type` — no runtime dependency on
 * `yjs` itself, on the persistence repo, or on the room registry. The
 * siblings will land in parallel commits.
 *
 * Forward-declared siblings (do NOT add runtime imports of these files):
 *   - ./yjs-adapter   (Phase 4 sub-task #6)  — `YjsAdapter.diffUpdate`,
 *                                              state-vector helpers.
 *   - ./repo          (Phase 4 sub-task that wires Phase 2 persistence)
 *                                            — `loadDoc`, `replayOplog`,
 *                                              `appendUpdate`.
 *   - ../room         (Phase 3 sub-task #5)  — `Room`, `MemberHandle`.
 *
 * No external runtime dependencies. No Yjs import. No Mongo import. No
 * `ws` import. Tests for this file (Phase 4 sub-task #10 fuzz suite) feed
 * synthetic frames in and assert on the `send` / `broadcast` / `appendUpdate`
 * call shapes.
 */

// ---------------------------------------------------------------------------
// Forward-declared sibling types. Imported via `import type` so this file
// stays independently compilable even before the siblings land. The real
// modules will export these names at runtime; we only consume the shapes.
// ---------------------------------------------------------------------------

import type { Room, MemberHandle } from '../room.js';

/**
 * Forward-decl of the persistence facade owned by the Phase 4 repo
 * sub-task. The concrete implementation will compose the Phase 2 helpers
 * from `docs/adr/sabflow-persistence.md` §5.1 (`loadDoc` + an oplog reader
 * + `appendUpdate`).
 *
 * NOTE: this is intentionally the *minimum* surface this file consumes.
 * The real `PersistenceRepo` (referenced by `connection.ts` already) is a
 * superset; we narrow here so the type stays a contract, not a leak.
 */
export interface SyncRepo {
  /**
   * Load the most recent snapshot for the doc. Returns the encoded Yjs
   * update bytes that, when applied to a fresh `Y.Doc`, reconstitute the
   * compacted baseline. `version` tracks the compaction generation; `head`
   * is the highest oplog `seq` covered by the snapshot.
   *
   * Resolves to `null` if the doc does not exist or the caller lacks
   * workspace-scoped access. (Authorisation is enforced one layer up; this
   * method only round-trips Mongo+R2 via the repo.)
   */
  loadDoc(
    workspaceId: string,
    docId: string,
  ): Promise<{ snapshot: Uint8Array; version: number; head: number } | null>;

  /**
   * Replay the oplog tail above `fromSeq`, in seq order, yielding each
   * raw Yjs update buffer. The caller folds these on top of `snapshot`.
   * Implementations may stream or buffer; this signature accepts both
   * since the consumer (`handleSyncStep2` below) only iterates.
   */
  replayOplog(
    workspaceId: string,
    docId: string,
    fromSeq: number,
  ): AsyncIterable<Uint8Array> | Iterable<Uint8Array>;

  /**
   * Append a single client-emitted Yjs update to the doc's oplog. Returns
   * the assigned monotonic `seq` (used by Phase 4 sub-task #4 ack flow).
   * Persistence ordering vs broadcast ordering is left to the caller —
   * see `handleSyncUpdate` for the policy chosen here.
   */
  appendUpdate(
    workspaceId: string,
    docId: string,
    clientId: string,
    update: Uint8Array,
  ): Promise<{ seq: number }>;
}

/**
 * Forward-decl of the Yjs encode/decode facade owned by Phase 4 sub-task
 * #6. The real implementation wraps `yjs`'s `encodeStateAsUpdate`,
 * `encodeStateVector`, `diffUpdate`, and `mergeUpdates`. We only consume
 * the shape so this file does not gain a `yjs` runtime dep.
 */
export interface YjsAdapter {
  /**
   * Encode the server's current state vector for sync-step-1. The
   * adapter is responsible for assembling a logical Y.Doc from
   * `snapshot` + folded oplog before encoding; this file passes only the
   * baseline plus an optional oplog iterator.
   */
  encodeStateVector(input: {
    snapshot: Uint8Array;
    oplog?: Iterable<Uint8Array> | AsyncIterable<Uint8Array>;
  }): Promise<Uint8Array>;

  /**
   * Compute the Yjs update bytes that, when applied to a client holding
   * `remoteStateVector`, would bring it level with the server's snapshot
   * folded with `oplog`. This is the sync-step-2 server-to-client diff.
   */
  diffUpdate(input: {
    snapshot: Uint8Array;
    oplog?: Iterable<Uint8Array> | AsyncIterable<Uint8Array>;
    remoteStateVector: Uint8Array;
  }): Promise<Uint8Array>;

  /**
   * Lightweight structural validation of an inbound update buffer.
   * Returns true if the bytes look like a well-formed Yjs update; we do
   * NOT decode here — we let Yjs surface decode errors at apply time.
   * Phase 4 sub-task #10 (fuzz) exercises this gate.
   */
  isWellFormedUpdate(update: Uint8Array): boolean;
}

// ---------------------------------------------------------------------------
// Frame tags. Top-byte 0x00 = "yjs sync" per ADR §4.1; sub-tags scope the
// payload within that channel. Awareness (tag 0x01) and batch (tag 0x7F)
// are owned by siblings and intentionally not referenced here.
// ---------------------------------------------------------------------------

/** Top-byte for every frame this module produces or consumes. */
export const SYNC_TAG = 0x00;

/** Sub-tag enum. Stable wire constants — never renumber. */
export const SyncSubTag = Object.freeze({
  /** Server -> client: server state vector. */
  STEP_1: 0x00,
  /** Either direction: diff response keyed to a remote state vector. */
  STEP_2: 0x01,
  /** Either direction: incremental Yjs update. */
  UPDATE: 0x02,
} as const);

export type SyncSubTagValue = (typeof SyncSubTag)[keyof typeof SyncSubTag];

/**
 * Build a tag-prefixed binary frame: `[0x00, subTag, ...payload]`. Returns
 * a `Uint8Array` to stay zero-dep; the connection layer wraps to `Buffer`
 * (Buffer is a Uint8Array subclass under Node, so `member.send` accepts
 * either after a one-line `Buffer.from`).
 */
export function encodeSyncFrame(
  subTag: SyncSubTagValue,
  payload: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(2 + payload.byteLength);
  out[0] = SYNC_TAG;
  out[1] = subTag;
  out.set(payload, 2);
  return out;
}

/**
 * Inverse of `encodeSyncFrame`. Returns `null` if the frame is not a sync
 * frame or is malformed (truncated header, unknown sub-tag). The caller
 * should drop unknown frames; we do not throw because the connection
 * layer's ADR §5 backpressure policy is "shed, not buffer", which extends
 * to unparseable frames.
 */
export function decodeSyncFrame(
  frame: Uint8Array,
): { subTag: SyncSubTagValue; payload: Uint8Array } | null {
  if (frame.byteLength < 2) return null;
  if (frame[0] !== SYNC_TAG) return null;
  const sub = frame[1] as SyncSubTagValue;
  if (sub !== SyncSubTag.STEP_1 && sub !== SyncSubTag.STEP_2 && sub !== SyncSubTag.UPDATE) {
    return null;
  }
  // `subarray` shares the underlying buffer — no copy. Safe because the
  // caller (connection.ts) hands us the frame and immediately drops it.
  return { subTag: sub, payload: frame.subarray(2) };
}

// ---------------------------------------------------------------------------
// Send shim. The connection layer hands us a `send` callback (a thin
// wrapper around `member.send`) so this module does not need to know
// about Buffer vs Uint8Array vs the WebSocket object.
// ---------------------------------------------------------------------------

export type SendFn = (frame: Uint8Array) => void;

// ---------------------------------------------------------------------------
// 1. initialSyncStep1 — server emits its state vector to a fresh joiner.
// ---------------------------------------------------------------------------

/**
 * Inputs the connection layer threads through after `join.ok` succeeds.
 * `room` is the membership object from `../room.ts`; we read
 * `workspaceId` + `docId` off it (the only fields we need from the room)
 * so we never have to reach into the room's internal state.
 */
export interface InitialSyncStep1Args {
  room: Pick<Room, 'workspaceId' | 'docId'>;
  send: SendFn;
  repo: SyncRepo;
  yjs: YjsAdapter;
}

/**
 * Send the server's state vector to the client as a `[0x00, 0x00, ...sv]`
 * binary frame. Pulls the current snapshot + oplog tail from the repo,
 * hands them to the Yjs adapter for state-vector encoding, then frames
 * and dispatches.
 *
 * Returns `void`. Errors are logged-and-swallowed by the connection layer
 * which catches the thrown promise rejection; we surface them by throwing
 * because there's no recovery path inside this function — the connection
 * handler must decide whether to close the socket or retry.
 *
 * If the doc does not exist (repo returns `null`), we emit an empty
 * state-vector frame so the client transitions out of the "waiting for
 * SS1" state cleanly and falls back to creating a fresh doc on the
 * server side (Phase 4 sub-task #4 ack flow handles the absence signal).
 */
export async function initialSyncStep1(args: InitialSyncStep1Args): Promise<void> {
  const { room, send, repo, yjs } = args;

  const loaded = await repo.loadDoc(room.workspaceId, room.docId);
  let sv: Uint8Array;
  if (loaded === null) {
    // Empty SV: client treats this as "fresh doc, you own the next SS2".
    sv = new Uint8Array(0);
  } else {
    const oplog = repo.replayOplog(room.workspaceId, room.docId, loaded.head);
    sv = await yjs.encodeStateVector({ snapshot: loaded.snapshot, oplog });
  }

  send(encodeSyncFrame(SyncSubTag.STEP_1, sv));
}

// ---------------------------------------------------------------------------
// 2. handleSyncStep2 — server responds with the diff for a remote SV.
// ---------------------------------------------------------------------------

export interface HandleSyncStep2Args {
  /** The client-supplied state vector (raw bytes inside the SS2 frame). */
  remoteSv: Uint8Array;
  room: Pick<Room, 'workspaceId' | 'docId'>;
  send: SendFn;
  repo: SyncRepo;
  yjs: YjsAdapter;
}

/**
 * Server-side of sync-step-2: compute the Yjs update that brings the
 * client (which holds `remoteSv`) level with the server's view of the
 * doc, and send it as a `[0x00, 0x01, ...update]` binary frame.
 *
 * Algorithm:
 *   1. Load the doc snapshot + oplog tail via `repo.loadDoc` /
 *      `repo.replayOplog`.
 *   2. Hand both, plus `remoteSv`, to `yjs.diffUpdate`. The adapter
 *      assembles the logical doc internally and returns the diff bytes.
 *   3. Frame and send.
 *
 * Edge cases:
 *   - Empty `remoteSv` (zero-length): the adapter treats this as "client
 *     has nothing" and returns the full state — exactly the n8n
 *     "first-time-load" path we mirror.
 *   - Doc absent from repo: we send an empty diff frame so the handshake
 *     still completes; the client SDK will then upload its own state via
 *     a follow-up `update` frame and the server will persist it.
 */
export async function handleSyncStep2(args: HandleSyncStep2Args): Promise<void> {
  const { remoteSv, room, send, repo, yjs } = args;

  const loaded = await repo.loadDoc(room.workspaceId, room.docId);
  let diff: Uint8Array;
  if (loaded === null) {
    diff = new Uint8Array(0);
  } else {
    const oplog = repo.replayOplog(room.workspaceId, room.docId, loaded.head);
    diff = await yjs.diffUpdate({
      snapshot: loaded.snapshot,
      oplog,
      remoteStateVector: remoteSv,
    });
  }

  send(encodeSyncFrame(SyncSubTag.STEP_2, diff));
}

// ---------------------------------------------------------------------------
// 3. handleSyncUpdate — incremental update from a client.
// ---------------------------------------------------------------------------

/**
 * Minimal slice of `Room` we need to fan out to peers. Pinned narrow so
 * we don't accidentally couple to `Room`'s membership internals. The
 * `MemberHandle` carries the workspace + connection scoping we use to
 * pick the broadcast `senderConnId`.
 */
export interface BroadcastableRoom {
  workspaceId: string;
  docId: string;
  broadcast(senderConnId: string | null, frame: Buffer | Uint8Array): void;
}

/**
 * Minimal slice of the sender's identity. `connectionId` excludes the
 * sender from the broadcast fan-out (Yjs already applied the update
 * locally). `clientId` is the Yjs clientID (stringified) we attribute the
 * oplog row to — this is *not* the SabNode userId; per ADR §1 the oplog
 * is keyed by Yjs clientId for CRDT causality.
 */
export interface SyncSender {
  connectionId: MemberHandle['connectionId'];
  clientId: string;
}

export interface HandleSyncUpdateArgs {
  /** The raw Yjs update bytes (sub-frame payload, NOT the wire frame). */
  update: Uint8Array;
  room: BroadcastableRoom;
  sender: SyncSender;
  repo: SyncRepo;
  yjs: YjsAdapter;
}

/**
 * Apply a client-emitted incremental update.
 *
 * Order of operations (chosen deliberately):
 *   1. Validate the frame via `yjs.isWellFormedUpdate`. A malformed
 *      update is dropped silently; the connection layer's per-socket
 *      rate-limit (ADR §5) handles repeat offenders.
 *   2. Re-frame as `[0x00, 0x02, ...update]` and broadcast to all peers
 *      EXCEPT the sender via `room.broadcast(sender.connectionId, frame)`.
 *   3. Persist via `repo.appendUpdate`. Broadcast precedes persistence
 *      because Yjs guarantees eventual consistency — losing a persisted
 *      update is recoverable (clients resync from snapshot + oplog tail
 *      on next handshake), but a late broadcast adds visible cursor
 *      lag. The repo's `seq` allocation handles the durability ordering;
 *      the broadcast does not depend on `seq` being assigned first.
 *
 * Returns the allocated `seq` so the connection layer can pipe it into
 * the Phase 4 sub-task #5 ack/nack channel. Errors from `appendUpdate`
 * are propagated; the connection layer decides whether to nack or close.
 */
export async function handleSyncUpdate(
  args: HandleSyncUpdateArgs,
): Promise<{ seq: number } | null> {
  const { update, room, sender, repo, yjs } = args;

  if (!yjs.isWellFormedUpdate(update)) {
    return null;
  }

  const frame = encodeSyncFrame(SyncSubTag.UPDATE, update);
  // `Room.broadcast` accepts a `Buffer` per its current signature, but
  // `Buffer` is a Uint8Array subclass — passing the Uint8Array directly
  // is safe in Node. The runtime composition step (Phase 4 sub-task #2)
  // may wrap with `Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength)`
  // if a stricter check is added; this file stays Buffer-free.
  room.broadcast(sender.connectionId, frame);

  const { seq } = await repo.appendUpdate(
    room.workspaceId,
    room.docId,
    sender.clientId,
    update,
  );
  return { seq };
}

// ---------------------------------------------------------------------------
// Re-exports — kept narrow so siblings can compose without re-deriving
// the wire constants. The frame tag + sub-tag values are part of the
// stable on-wire contract and any change requires a sync-protocol ADR.
// ---------------------------------------------------------------------------

export type { Room, MemberHandle };
