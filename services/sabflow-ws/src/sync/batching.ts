/**
 * SabFlow WebSocket gateway — sync-aware inbound update batching.
 *
 * Source of truth: docs/adr/sabflow-ws-gateway-node.md §5 (rate caps),
 * §4.2 (sync frame format), §7 (ack/nack semantics).
 *
 * Track A Phase 4 sub-task #8 — companion to the 16 ms outbound coalescer
 * in `src/backpressure.ts` (`OutboundCoalescer`, COALESCE_WINDOW_MS = 16).
 *
 *   | Knob                            | Default                     |
 *   |---------------------------------|-----------------------------|
 *   | Inbound debounce window         | 8 ms                        |
 *   | Max merged updates per flush    | 32                          |
 *   | Max combined payload bytes      | 64 KiB                      |
 *
 * Why 8 ms (half the outbound 16 ms window): we want the server to keep up
 * with rapid client-side typing bursts without letting individual Yjs
 * updates ride a full RTT each. Merging on the server before `appendUpdate`
 * also collapses N storage writes + N broadcasts into one.
 *
 * Ordering: the wire-level update order is preserved across the merge —
 * `YjsAdapter.mergeUpdates` is required to fold in arrival order so the
 * merged update encodes the same client clocks (HLC / Yjs StateVector
 * monotonicity).
 *
 * Failure path: if `repo.appendUpdate` rejects, every queued `updateId` in
 * the failed batch is NACKed via `acks.sendNack`; clients re-emit per their
 * reconnect / replay policy (see `src/reconnect.ts`).
 *
 * No static imports of the sibling Yjs / repo / ack modules — all three
 * are forward-declared so this file can compile and be unit-tested
 * standalone.
 *
 * Sibling consumers (not in this file's ownership):
 *   - services/sabflow-ws/src/connection.ts — owns the per-socket instance
 *     and wires `onMerged` to the room broadcaster.
 */

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Inbound debounce window (ms). Half the outbound 16 ms coalesce window. */
export const INBOUND_DEBOUNCE_MS = 8;

/** Maximum number of pending updates before a forced flush. */
export const MAX_BATCH_UPDATES = 32;

/** Maximum combined payload byte length before a forced flush. */
export const MAX_BATCH_BYTES = 64 * 1024;

/* ------------------------------------------------------------------ */
/* Forward-declared sibling interfaces                                 */
/* ------------------------------------------------------------------ */

/**
 * Subset of the Yjs-adapter API consumed by the batcher. The real
 * implementation lives in a sibling module (Track A Phase 4 sub-task #6)
 * and is injected at construction so this file has no static dependency
 * on `yjs`.
 */
export interface YjsAdapter {
  /**
   * Merge `updates` in arrival order into a single Yjs update. Must encode
   * the same client clocks as the inputs (no clock rewrites). The result is
   * what gets written to storage and broadcast to peers.
   */
  mergeUpdates(updates: Uint8Array[]): Uint8Array;
}

/**
 * Subset of the repo API consumed by the batcher. The real implementation
 * persists the merged update to the SabFlow document store (Postgres /
 * blob, depending on doc size — see ADR §8).
 */
export interface Repo {
  /**
   * Append a merged Yjs update for `docId`. Resolves once the write is
   * durable. Rejects on storage failure — the batcher will then NACK every
   * queued `updateId`.
   */
  appendUpdate(docId: string, merged: Uint8Array): Promise<void>;
}

/**
 * Subset of the ack-router API consumed by the batcher. Acks / nacks are
 * sent back over the same socket the update arrived on (per-connection
 * batcher → per-connection ack channel).
 */
export interface Acks {
  /** Acknowledge that `updateId` was durably appended. */
  sendAck(updateId: string): void;
  /**
   * Reject `updateId`. The optional `reason` is forwarded to the client
   * for telemetry / retry decisions (`'merge_failed'` | `'append_failed'`
   * | `'disposed'`).
   */
  sendNack(updateId: string, reason?: string): void;
}

/* ------------------------------------------------------------------ */
/* Batcher                                                             */
/* ------------------------------------------------------------------ */

/** A single inbound Yjs update queued for the next debounce flush. */
export interface PendingUpdate {
  /** Client-assigned id used to ack / nack back to the originator. */
  updateId: string;
  /** Encoded Yjs update bytes (no frame tag). */
  payload: Uint8Array;
}

/**
 * Invoked once per successful flush, after `repo.appendUpdate` has
 * resolved. Receives the merged Yjs update so the connection layer can
 * broadcast it to room peers exactly once per batch.
 *
 * Errors thrown here are caught and the batch is NACKed with
 * `'broadcast_failed'`, mirroring the append-failure path.
 */
export type OnMergedFn = (merged: Uint8Array, docId: string) => void;

export interface InboundUpdateBatcherOptions {
  /** Logical doc this batcher accumulates updates for. */
  docId: string;
  /** Sibling Yjs merge adapter. */
  yjs: YjsAdapter;
  /** Sibling repo. */
  repo: Repo;
  /** Sibling ack/nack channel. */
  acks: Acks;
  /** Broadcast hook called once per merged flush. */
  onMerged: OnMergedFn;
  /** Debounce window in ms. Defaults to {@link INBOUND_DEBOUNCE_MS}. */
  debounceMs?: number;
  /** Update-count cap. Defaults to {@link MAX_BATCH_UPDATES}. */
  maxUpdates?: number;
  /** Combined-byte cap. Defaults to {@link MAX_BATCH_BYTES}. */
  maxBytes?: number;
  /** Test seam — replace `setTimeout`. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  /** Test seam — replace `clearTimeout`. */
  clearTimer?: (handle: unknown) => void;
}

/** Reasons surfaced to the client on NACK. */
export type NackReason =
  | 'merge_failed'
  | 'append_failed'
  | 'broadcast_failed'
  | 'disposed';

/**
 * Per-connection sync-aware update batcher.
 *
 * Holds pending Yjs updates from a single client, debounced 8 ms, and on
 * flush:
 *
 *   1. Merges every queued payload via `yjs.mergeUpdates` in arrival
 *      order (preserves client clocks).
 *   2. Persists the merged update once via `repo.appendUpdate`.
 *   3. Broadcasts once via the injected `onMerged` hook.
 *   4. Acks every queued `updateId` in arrival order.
 *
 * Any failure path NACKs every queued `updateId` for the affected batch —
 * the client is the source of truth and re-emits on reconnect.
 *
 * Flush triggers (whichever comes first):
 *   - 8 ms after the first queued update (debounce timer).
 *   - Queue reaches {@link MAX_BATCH_UPDATES} (32) — immediate flush.
 *   - Queue would exceed {@link MAX_BATCH_BYTES} (64 KiB) — immediate flush.
 *   - Explicit {@link flush} / {@link dispose} call.
 *
 * Owned 1:1 by a single WS connection. Not thread-safe — Node single-
 * threaded event loop is sufficient. {@link dispose} must be called from
 * the connection-close handler to NACK in-flight updates and stop timers.
 */
export class InboundUpdateBatcher {
  readonly docId: string;
  readonly debounceMs: number;
  readonly maxUpdates: number;
  readonly maxBytes: number;

  private readonly yjs: YjsAdapter;
  private readonly repo: Repo;
  private readonly acks: Acks;
  private readonly onMerged: OnMergedFn;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  /** Pending updates in arrival order. */
  private queue: PendingUpdate[] = [];
  /** Sum of `payload.byteLength` across `queue` (cheap overflow check). */
  private queuedBytes: number = 0;
  /** Active debounce timer handle, or `null` if no flush is scheduled. */
  private timerHandle: unknown = null;
  /** True after {@link dispose}; further {@link enqueue} calls NACK. */
  private disposed: boolean = false;
  /**
   * In-flight flush count. Used by {@link dispose} so we don't tear down
   * while a `repo.appendUpdate` promise is still resolving — that batch's
   * acks / nacks must still get out the door.
   */
  private inflight: number = 0;

  constructor(opts: InboundUpdateBatcherOptions) {
    this.docId = opts.docId;
    this.yjs = opts.yjs;
    this.repo = opts.repo;
    this.acks = opts.acks;
    this.onMerged = opts.onMerged;
    this.debounceMs = opts.debounceMs ?? INBOUND_DEBOUNCE_MS;
    this.maxUpdates = opts.maxUpdates ?? MAX_BATCH_UPDATES;
    this.maxBytes = opts.maxBytes ?? MAX_BATCH_BYTES;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /**
   * Queue an inbound update. May trigger a synchronous flush if the new
   * update would push the batch past either cap. If the batcher is
   * disposed the update is NACKed immediately with `'disposed'`.
   *
   * The flush itself is async (it awaits `repo.appendUpdate`), but the
   * caller does not need to await it — acks / nacks are delivered via the
   * injected `Acks` channel.
   */
  enqueue(update: PendingUpdate): void {
    if (this.disposed) {
      this.acks.sendNack(update.updateId, 'disposed');
      return;
    }

    // Overflow check: flush the existing batch *before* adding the new
    // entry so the post-add queue still respects the caps. Mirrors the
    // OutboundCoalescer overflow strategy in `src/backpressure.ts`.
    const nextCount = this.queue.length + 1;
    const nextBytes = this.queuedBytes + update.payload.byteLength;
    if (
      this.queue.length > 0 &&
      (nextCount > this.maxUpdates || nextBytes > this.maxBytes)
    ) {
      // Fire and forget — outcomes route through the ack channel, not here.
      void this.flushNow();
    }

    this.queue.push(update);
    this.queuedBytes += update.payload.byteLength;

    // Single update larger than the cap on its own: don't wait — flush.
    if (
      this.queue.length >= this.maxUpdates ||
      this.queuedBytes >= this.maxBytes
    ) {
      void this.flushNow();
      return;
    }

    if (this.timerHandle == null) {
      this.timerHandle = this.setTimer(() => {
        this.timerHandle = null;
        void this.flushNow();
      }, this.debounceMs);
    }
  }

  /**
   * Force-flush whatever is queued. Safe to call concurrently with the
   * debounce timer firing — the queue is swapped out atomically before any
   * async work begins, so re-entrant `enqueue` from inside `onMerged` lands
   * in the next batch rather than the in-flight one. Resolves once the
   * merged update has been durably appended and broadcast (or NACKed).
   */
  async flush(): Promise<void> {
    await this.flushNow();
  }

  /** Internal flush implementation. */
  private async flushNow(): Promise<void> {
    // Cancel any pending timer — we're flushing now.
    if (this.timerHandle != null) {
      this.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.queue.length === 0) return;

    // Atomic swap so re-entrant enqueue lands in the next batch.
    const batch = this.queue;
    this.queue = [];
    this.queuedBytes = 0;

    this.inflight++;
    try {
      let merged: Uint8Array;
      try {
        merged = this.yjs.mergeUpdates(batch.map((u) => u.payload));
      } catch {
        // Merge failed — every updateId is bad-data from our POV.
        this.nackAll(batch, 'merge_failed');
        return;
      }

      try {
        await this.repo.appendUpdate(this.docId, merged);
      } catch {
        this.nackAll(batch, 'append_failed');
        return;
      }

      // Storage is durable; broadcast next. If broadcast fails we still
      // NACK so the client retries — peers will catch up via Yjs sync on
      // their own next round-trip, but the originator deserves to know.
      try {
        this.onMerged(merged, this.docId);
      } catch {
        this.nackAll(batch, 'broadcast_failed');
        return;
      }

      // Ack every updateId in arrival order.
      for (const u of batch) {
        this.acks.sendAck(u.updateId);
      }
    } finally {
      this.inflight--;
    }
  }

  /** NACK every entry in `batch` with `reason`. */
  private nackAll(batch: PendingUpdate[], reason: NackReason): void {
    for (const u of batch) {
      this.acks.sendNack(u.updateId, reason);
    }
  }

  /**
   * Stop accepting updates, flush whatever is pending, NACK anything that
   * arrives after this point. Safe to call multiple times. Should be wired
   * to the connection-close handler so socket teardown does not orphan
   * queued updates.
   *
   * Resolves once any in-flight flush has settled. Does *not* throw —
   * teardown is best-effort.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    if (this.timerHandle != null) {
      this.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }

    // Drain the current queue (acks / nacks go through `flushNow`).
    if (this.queue.length > 0) {
      try {
        await this.flushNow();
      } catch {
        // Defensive — `flushNow` swallows its own errors, but the loop
        // contract is "dispose never throws".
      }
    }

    // If a previous flush is still inflight (e.g. await repo.appendUpdate),
    // it owns its own ack/nack lifecycle — nothing to do here.
  }

  /** Pending update count (test / debug). */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Pending payload bytes (test / debug). */
  get pendingBytes(): number {
    return this.queuedBytes;
  }

  /** True once {@link dispose} has been called (test / debug). */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Number of `flushNow` calls currently mid-await (test / debug). */
  get inflightFlushes(): number {
    return this.inflight;
  }
}
