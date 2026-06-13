/**
 * SabCRM — offline read cache (raw IndexedDB).
 *
 * A tiny, dependency-free IndexedDB wrapper that stashes recently-viewed CRM
 * records so the PWA shell (see `public/sabcrm-sw.js` +
 * `src/components/sabcrm/pwa-register.tsx`) can render a record's last-seen
 * snapshot while offline. IN-HOUSE only: no Dexie / idb / idb-keyval — hand
 * rolled against the platform `indexedDB` API.
 *
 * ## Guards
 *
 * Everything degrades to a no-op when there is no usable IndexedDB:
 *   - server-side (no `window` / no `indexedDB`, e.g. SSR / RSC / unit tests),
 *   - browsers that disable it (private mode in some engines),
 *   - any open/transaction failure (quota, corruption) — swallowed, never throws.
 *
 * This means a page may import + call these freely from a `'use client'`
 * component without crashing SSR or the server build.
 *
 * ## Pure helpers
 *
 * The cache-KEY building and TTL-PRUNE math are split out as pure, DOM-free
 * functions ({@link buildCacheKey}, {@link parseCacheKey}, {@link isExpired},
 * {@link pruneExpired}, {@link selectEvictions}) so they are unit-testable with
 * `node:test` / `tsx --test` without an IndexedDB polyfill. The DB methods are
 * thin shells around them.
 */

/* -------------------------------------------------------------------------- */
/* Pure helpers (NO DOM / NO IndexedDB — safe to unit test)                    */
/* -------------------------------------------------------------------------- */

/** Default record time-to-live in the offline cache: 7 days, in ms. */
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Hard ceiling on cached entries; oldest-touched evicted past this. */
export const MAX_ENTRIES = 500;

/** Key separator — `:` never appears in a Mongo ObjectId or an object slug. */
const KEY_SEP = ':';

/** A single cached record snapshot (the IndexedDB value shape). */
export interface CachedRecord {
  /** Composite primary key, see {@link buildCacheKey}. */
  key: string;
  /** The object slug (e.g. `opportunities`), kept for `listByObject`. */
  objectSlug: string;
  /** The record `_id`. */
  recordId: string;
  /** Display label captured at cache time (for offline list rendering). */
  label?: string;
  /** The record's `data` bag snapshot. */
  data: Record<string, unknown>;
  /** Epoch ms the snapshot was written/refreshed (TTL + LRU basis). */
  cachedAt: number;
}

/** Minimal slice of a CRM record this cache needs to persist a snapshot. */
export interface CacheableRecord {
  _id: string;
  object: string;
  data: Record<string, unknown>;
  label?: string;
}

/**
 * Build the composite primary key for a record snapshot: `<objectSlug>:<id>`.
 * Stable + collision-free across objects so the same id under two objects does
 * not clobber. Inputs are coerced to strings and the separator stripped from
 * the slug so a hostile slug cannot forge another object's namespace.
 */
export function buildCacheKey(objectSlug: string, recordId: string): string {
  const slug = String(objectSlug ?? '').split(KEY_SEP).join('');
  const id = String(recordId ?? '');
  return `${slug}${KEY_SEP}${id}`;
}

/** Inverse of {@link buildCacheKey}; null when the key is malformed. */
export function parseCacheKey(
  key: string,
): { objectSlug: string; recordId: string } | null {
  if (typeof key !== 'string') return null;
  const i = key.indexOf(KEY_SEP);
  if (i <= 0 || i >= key.length - 1) return null;
  return { objectSlug: key.slice(0, i), recordId: key.slice(i + 1) };
}

/**
 * True when a snapshot is older than `ttlMs` relative to `now`. A non-positive
 * or non-finite `ttlMs` disables expiry (always false). A snapshot with a
 * missing/invalid `cachedAt` is treated as expired (safe to drop).
 */
export function isExpired(
  entry: Pick<CachedRecord, 'cachedAt'>,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_TTL_MS,
): boolean {
  if (!(ttlMs > 0) || !Number.isFinite(ttlMs)) return false;
  const at = entry?.cachedAt;
  if (typeof at !== 'number' || !Number.isFinite(at)) return true;
  return now - at > ttlMs;
}

/**
 * Partition entries into the ones to keep vs. the keys to delete because they
 * have aged past `ttlMs`. Pure — the caller performs the actual deletes.
 */
export function pruneExpired(
  entries: CachedRecord[],
  now: number = Date.now(),
  ttlMs: number = DEFAULT_TTL_MS,
): { keep: CachedRecord[]; expiredKeys: string[] } {
  const keep: CachedRecord[] = [];
  const expiredKeys: string[] = [];
  for (const e of entries ?? []) {
    if (!e || typeof e.key !== 'string') continue;
    if (isExpired(e, now, ttlMs)) expiredKeys.push(e.key);
    else keep.push(e);
  }
  return { keep, expiredKeys };
}

/**
 * LRU eviction selection: given the entries that survived TTL pruning, return
 * the keys to evict so at most `max` remain — dropping the oldest `cachedAt`
 * first (ties broken by key for determinism). Pure.
 */
export function selectEvictions(
  entries: CachedRecord[],
  max: number = MAX_ENTRIES,
): string[] {
  const list = (entries ?? []).filter(
    (e): e is CachedRecord => !!e && typeof e.key === 'string',
  );
  if (!(max > 0)) return list.map((e) => e.key);
  if (list.length <= max) return [];
  const sorted = [...list].sort((a, b) => {
    const at = Number.isFinite(a.cachedAt) ? a.cachedAt : 0;
    const bt = Number.isFinite(b.cachedAt) ? b.cachedAt : 0;
    if (at !== bt) return at - bt; // oldest first
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return sorted.slice(0, list.length - max).map((e) => e.key);
}

/** Normalise a CRM record into the persisted snapshot shape. */
export function toCachedRecord(
  rec: CacheableRecord,
  now: number = Date.now(),
): CachedRecord | null {
  if (!rec || !rec._id || !rec.object) return null;
  return {
    key: buildCacheKey(rec.object, rec._id),
    objectSlug: String(rec.object),
    recordId: String(rec._id),
    label: typeof rec.label === 'string' ? rec.label : undefined,
    data:
      rec.data && typeof rec.data === 'object'
        ? (rec.data as Record<string, unknown>)
        : {},
    cachedAt: now,
  };
}

/* -------------------------------------------------------------------------- */
/* IndexedDB wrapper (browser only; no-ops everywhere else)                    */
/* -------------------------------------------------------------------------- */

const DB_NAME = 'sabcrm-offline';
const DB_VERSION = 1;
const STORE = 'records';

/** Is a usable IndexedDB present? False on the server + in unit tests. */
export function isIndexedDbAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { indexedDB?: unknown }).indexedDB !== 'undefined' &&
    (globalThis as { indexedDB?: unknown }).indexedDB !== null
  );
}

/** Promisify an IDBRequest. */
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Open (and lazily create) the DB. Memoised. Rejects when unavailable. */
function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB.open(
        DB_NAME,
        DB_VERSION,
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error('indexedDB.open threw'));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('objectSlug', 'objectSlug', { unique: false });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // If another tab triggers a version change, close so it can upgrade.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  }).catch((e) => {
    dbPromise = null; // allow a later retry
    throw e;
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/**
 * Cache (or refresh) a record snapshot for offline read. No-op + resolves
 * `false` when IndexedDB is unavailable or anything fails. After writing it
 * opportunistically prunes expired + over-cap entries (best-effort).
 */
export async function putRecord(
  rec: CacheableRecord,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<boolean> {
  const snapshot = toCachedRecord(rec);
  if (!snapshot) return false;
  if (!isIndexedDbAvailable()) return false;
  try {
    const db = await openDb();
    await reqToPromise(tx(db, 'readwrite').put(snapshot));
    // Fire-and-forget maintenance; never let it fail the put.
    void pruneAndEvict(ttlMs).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Read one cached snapshot, or null (also null when expired / unavailable). */
export async function getRecord(
  objectSlug: string,
  recordId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<CachedRecord | null> {
  if (!isIndexedDbAvailable()) return null;
  try {
    const db = await openDb();
    const key = buildCacheKey(objectSlug, recordId);
    const out = await reqToPromise<CachedRecord | undefined>(
      tx(db, 'readonly').get(key),
    );
    if (!out) return null;
    if (isExpired(out, Date.now(), ttlMs)) {
      // Lazily evict the stale hit.
      void deleteRecord(objectSlug, recordId).catch(() => undefined);
      return null;
    }
    return out;
  } catch {
    return null;
  }
}

/** List all non-expired snapshots (optionally filtered to one object slug). */
export async function listRecords(
  objectSlug?: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<CachedRecord[]> {
  if (!isIndexedDbAvailable()) return [];
  try {
    const db = await openDb();
    let all: CachedRecord[];
    if (objectSlug) {
      const idx = tx(db, 'readonly').index('objectSlug');
      all = await reqToPromise<CachedRecord[]>(idx.getAll(buildCacheKeySlug(objectSlug)));
    } else {
      all = await reqToPromise<CachedRecord[]>(tx(db, 'readonly').getAll());
    }
    const { keep } = pruneExpired(all ?? [], Date.now(), ttlMs);
    // newest first
    return keep.sort((a, b) => (b.cachedAt ?? 0) - (a.cachedAt ?? 0));
  } catch {
    return [];
  }
}

/** Sanitised slug used as the `objectSlug` index value (matches snapshot). */
function buildCacheKeySlug(objectSlug: string): string {
  return String(objectSlug ?? '').split(KEY_SEP).join('');
}

/** Delete one cached snapshot. Resolves `false` on failure / unavailable. */
export async function deleteRecord(
  objectSlug: string,
  recordId: string,
): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;
  try {
    const db = await openDb();
    await reqToPromise(tx(db, 'readwrite').delete(buildCacheKey(objectSlug, recordId)));
    return true;
  } catch {
    return false;
  }
}

/** Drop the entire offline cache. Resolves `false` on failure / unavailable. */
export async function clearAll(): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;
  try {
    const db = await openDb();
    await reqToPromise(tx(db, 'readwrite').clear());
    return true;
  } catch {
    return false;
  }
}

/**
 * Maintenance pass: delete TTL-expired snapshots, then LRU-evict down to
 * {@link MAX_ENTRIES}. Best-effort; resolves the count removed (0 on failure).
 */
export async function pruneAndEvict(
  ttlMs: number = DEFAULT_TTL_MS,
  max: number = MAX_ENTRIES,
): Promise<number> {
  if (!isIndexedDbAvailable()) return 0;
  try {
    const db = await openDb();
    const all = await reqToPromise<CachedRecord[]>(tx(db, 'readonly').getAll());
    const now = Date.now();
    const { keep, expiredKeys } = pruneExpired(all ?? [], now, ttlMs);
    const evictKeys = selectEvictions(keep, max);
    const toDelete = [...expiredKeys, ...evictKeys];
    if (toDelete.length === 0) return 0;
    const store = tx(db, 'readwrite');
    await Promise.all(toDelete.map((k) => reqToPromise(store.delete(k))));
    return toDelete.length;
  } catch {
    return 0;
  }
}
