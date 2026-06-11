/**
 * IndexedDB-backed `OutboxStore` — the browser persistence for offline edits + the local engine
 * snapshot. Survives reloads and crashes, so a user who edits offline and closes the tab still has
 * their work (and the pending queue) when they reopen. Uses one key-value store with namespaced keys.
 */
import type { OutboxStore, QueuedBatch } from "./outbox.ts";

const DB_NAME = "sabsheet-offline";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

const snapKey = (id: string) => `snap:${id}`;
const seqKey = (id: string) => `seq:${id}`;
const queueKey = (id: string) => `queue:${id}`;

export class IdbOutboxStore implements OutboxStore {
  private dbp = openDb();

  async getSnapshot(id: string): Promise<Uint8Array | null> {
    const v = await tx<ArrayBuffer | undefined>(await this.dbp, "readonly", (s) => s.get(snapKey(id)));
    return v ? new Uint8Array(v) : null;
  }

  async setSnapshot(id: string, bytes: Uint8Array, seq: number): Promise<void> {
    const db = await this.dbp;
    // Store a copy of the bytes (structured clone of the underlying buffer).
    await tx(db, "readwrite", (s) => s.put(bytes.slice().buffer, snapKey(id)));
    await tx(db, "readwrite", (s) => s.put(seq, seqKey(id)));
  }

  async getSeq(id: string): Promise<number> {
    const v = await tx<number | undefined>(await this.dbp, "readonly", (s) => s.get(seqKey(id)));
    return v ?? 0;
  }

  async setSeq(id: string, seq: number): Promise<void> {
    await tx(await this.dbp, "readwrite", (s) => s.put(seq, seqKey(id)));
  }

  async enqueue(id: string, batch: QueuedBatch): Promise<void> {
    const q = await this.list(id);
    q.push(batch);
    await tx(await this.dbp, "readwrite", (s) => s.put(q, queueKey(id)));
  }

  async list(id: string): Promise<QueuedBatch[]> {
    const v = await tx<QueuedBatch[] | undefined>(await this.dbp, "readonly", (s) => s.get(queueKey(id)));
    return v ?? [];
  }

  async remove(id: string, batchId: number): Promise<void> {
    const q = (await this.list(id)).filter((b) => b.id !== batchId);
    await tx(await this.dbp, "readwrite", (s) => s.put(q, queueKey(id)));
  }

  async clearQueue(id: string): Promise<void> {
    await tx(await this.dbp, "readwrite", (s) => s.put([], queueKey(id)));
  }
}

/** True when IndexedDB is usable (SSR / private-mode guards). */
export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
