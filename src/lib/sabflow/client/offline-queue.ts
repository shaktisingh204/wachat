/**
 * SabFlow CRDT — Offline queue (Track A · Phase 5 · #5)
 *
 * Persists outbound Yjs updates to IndexedDB while the realtime WebSocket
 * is disconnected, then replays them in order on reconnect.
 *
 * Storage layout (matches `idb` package's call conventions, but uses raw
 * `indexedDB` to avoid pulling in a new dep):
 *
 *   database :  sabflow-offline
 *   store    :  pending-updates
 *   keyPath  :  "<docId>:<seq>"   — monotonically increasing per doc
 *   value    :  { docId, update: Uint8Array, ts, updateId, seq, size }
 *
 * Notes:
 * - SSR-safe: all IndexedDB access is lazy-guarded by `isAvailable()`.
 *   On Node / RSC / a browser without IndexedDB, every public method
 *   resolves to a no-op safe default (queue acts like a sink).
 * - Per-doc 10 MB soft cap; oldest entries are evicted FIFO and a
 *   `'truncated'` event is emitted so the UI can warn the user.
 */

// -------- types --------

export interface QueuedUpdate {
  docId: string;
  update: Uint8Array;
  /** Caller-supplied id so the server can dedupe replays. */
  updateId: string;
  /** Monotonic per-doc sequence assigned at enqueue time. */
  seq: number;
  /** Wall-clock ms of enqueue. */
  ts: number;
  /** Byte length of `update` — cached so peek() is O(n) without re-measuring. */
  size: number;
}

export interface FlushResult {
  flushed: number;
  failed: number;
}

export interface OfflineQueueOptions {
  /** Per-doc soft byte cap before oldest entries are dropped. Default 10 MB. */
  perDocCapBytes?: number;
  /** Override DB name (mostly for tests). */
  dbName?: string;
  /** Override store name (mostly for tests). */
  storeName?: string;
}

export type OfflineQueueEvent =
  | { type: 'enqueued'; docId: string; updateId: string; seq: number }
  | { type: 'flushed'; docId: string; updateId: string; seq: number }
  | { type: 'flush-failed'; docId: string; updateId: string; seq: number; error: unknown }
  | { type: 'truncated'; docId: string; droppedCount: number; droppedBytes: number }
  | { type: 'cleared'; docId: string };

export type OfflineQueueListener = (event: OfflineQueueEvent) => void;

export type Sender = (update: Uint8Array, updateId: string) => Promise<void>;

// -------- constants --------

const DEFAULT_DB_NAME = 'sabflow-offline';
const DEFAULT_STORE_NAME = 'pending-updates';
const DEFAULT_PER_DOC_CAP_BYTES = 10 * 1024 * 1024; // 10 MB
const DOC_INDEX = 'by-docId';

// -------- helpers --------

function isAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { indexedDB?: IDBFactory }).indexedDB !== 'undefined'
  );
}

function makeKey(docId: string, seq: number): string {
  return `${docId}:${seq.toString(36).padStart(12, '0')}`;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// -------- class --------

export class OfflineQueue {
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly perDocCapBytes: number;

  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly seqCounters = new Map<string, number>();
  private readonly listeners = new Set<OfflineQueueListener>();

  constructor(opts: OfflineQueueOptions = {}) {
    this.dbName = opts.dbName ?? DEFAULT_DB_NAME;
    this.storeName = opts.storeName ?? DEFAULT_STORE_NAME;
    this.perDocCapBytes = opts.perDocCapBytes ?? DEFAULT_PER_DOC_CAP_BYTES;
  }

  // -------- public API --------

  /** Subscribe to queue events. Returns an unsubscribe fn. */
  on(listener: OfflineQueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Persist an outbound update. Append-only. */
  async enqueue(args: {
    docId: string;
    update: Uint8Array;
    updateId: string;
  }): Promise<void> {
    if (!isAvailable()) return;
    const { docId, update, updateId } = args;
    const db = await this.openDb();

    // 1) Get a fresh seq number for this doc.
    const seq = await this.nextSeq(db, docId);

    // 2) Insert the entry.
    const entry: QueuedUpdate = {
      docId,
      update,
      updateId,
      seq,
      ts: Date.now(),
      size: update.byteLength,
    };

    {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(entry, makeKey(docId, seq));
      await txDone(tx);
    }

    this.emit({ type: 'enqueued', docId, updateId, seq });

    // 3) Enforce the soft cap (oldest-first eviction).
    await this.enforceCap(db, docId);
  }

  /**
   * Drain queued updates for ALL docs, in (docId, seq) order, calling
   * `send` for each. On failure we stop draining that doc and leave the
   * remaining entries in place so they can be retried later.
   */
  async flushTo(send: Sender): Promise<FlushResult> {
    if (!isAvailable()) return { flushed: 0, failed: 0 };
    const db = await this.openDb();

    // Snapshot keys + entries up front (one read tx) so we don't hold a
    // long-lived tx open across `await send()` calls (IndexedDB
    // transactions auto-commit when the microtask queue empties).
    const entries: { key: string; value: QueuedUpdate }[] = [];
    {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve();
          entries.push({
            key: String(cursor.primaryKey),
            value: cursor.value as QueuedUpdate,
          });
          cursor.continue();
        };
      });
    }

    // Cursor traversal on the keyPath is already ordered by key, and our
    // keys are `<docId>:<seq>` zero-padded — so this groups by docId and
    // ascends by seq naturally.
    let flushed = 0;
    let failed = 0;
    const stalledDocs = new Set<string>();

    for (const { key, value } of entries) {
      if (stalledDocs.has(value.docId)) {
        // A prior entry for this doc failed — preserve order, skip rest.
        failed += 1;
        continue;
      }
      try {
        await send(value.update, value.updateId);
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).delete(key);
        await txDone(tx);
        flushed += 1;
        this.emit({
          type: 'flushed',
          docId: value.docId,
          updateId: value.updateId,
          seq: value.seq,
        });
      } catch (error) {
        failed += 1;
        stalledDocs.add(value.docId);
        this.emit({
          type: 'flush-failed',
          docId: value.docId,
          updateId: value.updateId,
          seq: value.seq,
          error,
        });
      }
    }

    return { flushed, failed };
  }

  /** Read all pending entries for a doc (for the "N unsynced changes" UI). */
  async peek(docId: string): Promise<QueuedUpdate[]> {
    if (!isAvailable()) return [];
    const db = await this.openDb();
    const tx = db.transaction(this.storeName, 'readonly');
    const index = tx.objectStore(this.storeName).index(DOC_INDEX);
    const out = await reqToPromise(index.getAll(IDBKeyRange.only(docId)));
    // Index getAll() returns insertion-order within a key — but be defensive.
    return (out as QueuedUpdate[]).slice().sort((a, b) => a.seq - b.seq);
  }

  /** Drop every pending entry for a doc. */
  async clear(docId: string): Promise<void> {
    if (!isAvailable()) return;
    const db = await this.openDb();
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    const index = store.index(DOC_INDEX);
    const req = index.openCursor(IDBKeyRange.only(docId));
    await new Promise<void>((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        cursor.delete();
        cursor.continue();
      };
    });
    await txDone(tx);
    this.seqCounters.delete(docId);
    this.emit({ type: 'cleared', docId });
  }

  // -------- internals --------

  private emit(event: OfflineQueueEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors — they must not break queue operations.
      }
    }
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      if (!idb) {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = idb.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName);
          store.createIndex(DOC_INDEX, 'docId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
    // If the open fails, allow a future caller to retry.
    this.dbPromise.catch(() => {
      this.dbPromise = null;
    });
    return this.dbPromise;
  }

  private async nextSeq(db: IDBDatabase, docId: string): Promise<number> {
    const cached = this.seqCounters.get(docId);
    if (cached !== undefined) {
      const next = cached + 1;
      this.seqCounters.set(docId, next);
      return next;
    }
    // Cold start: find the max existing seq for this doc.
    const tx = db.transaction(this.storeName, 'readonly');
    const index = tx.objectStore(this.storeName).index(DOC_INDEX);
    const req = index.openCursor(IDBKeyRange.only(docId), 'prev');
    const maxSeq = await new Promise<number>((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(0);
        const value = cursor.value as QueuedUpdate;
        resolve(value.seq);
      };
    });
    const next = maxSeq + 1;
    this.seqCounters.set(docId, next);
    return next;
  }

  private async enforceCap(db: IDBDatabase, docId: string): Promise<void> {
    // Collect oldest-first until total bytes fit under the cap.
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    const index = store.index(DOC_INDEX);

    // Pass 1: sum total size.
    let total = 0;
    const all: { key: IDBValidKey; size: number; seq: number }[] = [];
    await new Promise<void>((resolve, reject) => {
      const req = index.openCursor(IDBKeyRange.only(docId));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        const value = cursor.value as QueuedUpdate;
        total += value.size;
        all.push({ key: cursor.primaryKey, size: value.size, seq: value.seq });
        cursor.continue();
      };
    });

    if (total <= this.perDocCapBytes) {
      // Nothing to do — let the tx auto-commit.
      await txDone(tx);
      return;
    }

    // Pass 2: drop oldest (lowest seq) until we fit.
    all.sort((a, b) => a.seq - b.seq);
    let droppedCount = 0;
    let droppedBytes = 0;
    for (const entry of all) {
      if (total <= this.perDocCapBytes) break;
      store.delete(entry.key);
      total -= entry.size;
      droppedCount += 1;
      droppedBytes += entry.size;
    }
    await txDone(tx);

    if (droppedCount > 0) {
      this.emit({ type: 'truncated', docId, droppedCount, droppedBytes });
    }
  }
}

// -------- module-level convenience singleton (opt-in) --------

let sharedQueue: OfflineQueue | null = null;

/**
 * Lazy shared queue. Most callers (the WS client, the React hook, the
 * unsynced-changes indicator) want the same instance so peek() reflects
 * what enqueue() just wrote. Tests can ignore this and `new OfflineQueue()`
 * with a custom `dbName`.
 */
export function getOfflineQueue(): OfflineQueue {
  if (!sharedQueue) sharedQueue = new OfflineQueue();
  return sharedQueue;
}
