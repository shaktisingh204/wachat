/**
 * Offline-first persistence for SabSheet.
 *
 * The whole engine runs client-side in WASM, so editing, formulas, formatting, undo, clipboard, and
 * fill all work with no network. The only thing that needs the server is durable cloud save. This
 * module makes that resilient: every edit is cached locally and queued in an **outbox**; flushes go to
 * the server when online and are retried automatically when connectivity returns. Nothing the user
 * does in the grid is lost offline — it just syncs later.
 *
 * The queue logic is storage-agnostic (`OutboxStore`) so it is unit-testable with an in-memory store;
 * the browser uses the IndexedDB adapter in `idb-store.ts`.
 */
import type { Command } from "../commands/ops.ts";

/** One queued, not-yet-synced edit batch. `id` is a monotonic local sequence. */
export interface QueuedBatch {
  id: number;
  commands: Command[];
}

/** Pluggable persistence for the outbox + the last-known engine snapshot, per workbook. */
export interface OutboxStore {
  getSnapshot(workbookId: string): Promise<Uint8Array | null>;
  setSnapshot(workbookId: string, bytes: Uint8Array, seq: number): Promise<void>;
  getSeq(workbookId: string): Promise<number>;
  setSeq(workbookId: string, seq: number): Promise<void>;
  enqueue(workbookId: string, batch: QueuedBatch): Promise<void>;
  list(workbookId: string): Promise<QueuedBatch[]>;
  remove(workbookId: string, id: number): Promise<void>;
  clearQueue(workbookId: string): Promise<void>;
}

/** Sends one batch to the server; resolves with the new seq, or `{ rejected: true }` on conflict. */
export type FlushFn = (
  batch: QueuedBatch,
  baseSeq: number,
) => Promise<{ seq: number; rejected: boolean }>;

export type SyncState = "synced" | "pending" | "offline" | "conflict";

export interface OutboxOptions {
  workbookId: string;
  store: OutboxStore;
  flush: FlushFn;
  /** Reports whether the network is currently believed reachable. */
  isOnline: () => boolean;
  onStateChange?: (state: SyncState, pending: number) => void;
}

/**
 * Manages the local cache + the queue of un-synced batches for one workbook. Call `record` after every
 * local edit; call `flush` on reconnect (or after each edit when online).
 */
export class OfflineOutbox {
  private readonly workbookId: string;
  private readonly store: OutboxStore;
  private readonly flushFn: FlushFn;
  private readonly isOnline: () => boolean;
  private readonly onStateChange?: (state: SyncState, pending: number) => void;

  private nextId = 1;
  private flushing = false;
  private conflicted = false;

  constructor(opts: OutboxOptions) {
    this.workbookId = opts.workbookId;
    this.store = opts.store;
    this.flushFn = opts.flush;
    this.isOnline = opts.isOnline;
    this.onStateChange = opts.onStateChange;
  }

  /** Restore the local snapshot cached on this device (used when the server is unreachable). */
  async cachedSnapshot(): Promise<{ bytes: Uint8Array; seq: number } | null> {
    const bytes = await this.store.getSnapshot(this.workbookId);
    if (!bytes) return null;
    const seq = await this.store.getSeq(this.workbookId);
    return { bytes, seq };
  }

  /** Seed the known server seq (after a successful online bootstrap). */
  async setBaseSeq(seq: number): Promise<void> {
    await this.store.setSeq(this.workbookId, seq);
  }

  /**
   * Record a local edit: cache the fresh engine snapshot and queue the batch. Then attempt to flush.
   * The batch is durably queued *before* any network attempt, so a crash/refresh never loses it.
   */
  async record(commands: Command[], snapshot: Uint8Array): Promise<void> {
    const batch: QueuedBatch = { id: this.nextId++, commands };
    await this.store.enqueue(this.workbookId, batch);
    // Cache snapshot at the last-known seq; the real seq advances only on successful flush.
    const seq = await this.store.getSeq(this.workbookId);
    await this.store.setSnapshot(this.workbookId, snapshot, seq);
    await this.flush();
  }

  /** Try to push every queued batch in order. No-op (reports `offline`) when the network is down. */
  async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.conflicted) {
      await this.emit();
      return;
    }
    if (!this.isOnline()) {
      await this.emit();
      return;
    }
    this.flushing = true;
    try {
      const queue = await this.store.list(this.workbookId);
      for (const batch of queue) {
        let seq = await this.store.getSeq(this.workbookId);
        let res: { seq: number; rejected: boolean };
        try {
          res = await this.flushFn(batch, seq);
        } catch {
          // Treat a network failure as "still offline" — keep the batch queued and stop.
          break;
        }
        if (res.rejected) {
          // Another writer advanced the workbook; local + server have diverged.
          this.conflicted = true;
          break;
        }
        seq = res.seq;
        await this.store.setSeq(this.workbookId, seq);
        await this.store.remove(this.workbookId, batch.id);
      }
    } finally {
      this.flushing = false;
      await this.emit();
    }
  }

  /** Number of batches still waiting to sync. */
  async pendingCount(): Promise<number> {
    return (await this.store.list(this.workbookId)).length;
  }

  /** After a conflict, the caller re-bootstraps from the server snapshot and clears the queue. */
  async resolveConflict(serverSeq: number): Promise<void> {
    this.conflicted = false;
    await this.store.clearQueue(this.workbookId);
    await this.store.setSeq(this.workbookId, serverSeq);
    await this.emit();
  }

  private async emit(): Promise<void> {
    const pending = await this.pendingCount();
    const state: SyncState = this.conflicted
      ? "conflict"
      : !this.isOnline()
        ? "offline"
        : pending > 0
          ? "pending"
          : "synced";
    this.onStateChange?.(state, pending);
  }
}

/** In-memory `OutboxStore` for tests (and a non-persistent fallback). */
export class MemoryOutboxStore implements OutboxStore {
  private snapshots = new Map<string, Uint8Array>();
  private seqs = new Map<string, number>();
  private queues = new Map<string, QueuedBatch[]>();

  async getSnapshot(id: string) {
    return this.snapshots.get(id) ?? null;
  }
  async setSnapshot(id: string, bytes: Uint8Array, seq: number) {
    this.snapshots.set(id, bytes);
    this.seqs.set(id, seq);
  }
  async getSeq(id: string) {
    return this.seqs.get(id) ?? 0;
  }
  async setSeq(id: string, seq: number) {
    this.seqs.set(id, seq);
  }
  async enqueue(id: string, batch: QueuedBatch) {
    const q = this.queues.get(id) ?? [];
    q.push(batch);
    this.queues.set(id, q);
  }
  async list(id: string) {
    return [...(this.queues.get(id) ?? [])];
  }
  async remove(id: string, batchId: number) {
    this.queues.set(id, (this.queues.get(id) ?? []).filter((b) => b.id !== batchId));
  }
  async clearQueue(id: string) {
    this.queues.set(id, []);
  }
}
