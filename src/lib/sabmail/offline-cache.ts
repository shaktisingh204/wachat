/**
 * SabMail client-side offline message cache.
 *
 * Wire as a read-through cache in the inbox client; Dexie activates when
 * installed (npm i dexie), else localStorage.
 *
 * This module is `"use client"`-safe: it has NO `'use server'` directive and
 * NEVER imports `server-only`. It runs entirely in the browser and degrades
 * gracefully — every function is defensive and resolves rather than throws,
 * returning `null` on a cache miss.
 *
 * Storage strategy (in priority order):
 *   1. Dexie (IndexedDB) — used when the `dexie` package is installed AND the
 *      runtime exposes `indexedDB`. Loaded via a NON-LITERAL dynamic import so
 *      TypeScript compiles WITHOUT the dependency present, and bundlers don't
 *      try to resolve it at build time.
 *   2. localStorage — JSON fallback, namespaced under `sabmail:cache:...`,
 *      used when Dexie is missing or IndexedDB is unavailable (SSR, private
 *      mode, etc.). Guarded by `typeof window`.
 *
 * If neither store is available the cache is a transparent no-op: writes
 * silently succeed, reads return `null`.
 */

// ---------------------------------------------------------------------------
// Keys & constants
// ---------------------------------------------------------------------------

const DB_NAME = 'sabmail-cache';
const LS_PREFIX = 'sabmail:cache:';

/** Composite key for a folder's message list. */
function messagesKey(accountId: any, folder: any): string {
  return `${String(accountId)}::${String(folder)}`;
}

/** Composite key for a single message body. */
function bodyKey(accountId: any, uid: any): string {
  return `${String(accountId)}::${String(uid)}`;
}

function lsMessagesKey(accountId: any, folder: any): string {
  return `${LS_PREFIX}messages:${messagesKey(accountId, folder)}`;
}

function lsBodyKey(accountId: any, uid: any): string {
  return `${LS_PREFIX}bodies:${bodyKey(accountId, uid)}`;
}

// ---------------------------------------------------------------------------
// Environment guards
// ---------------------------------------------------------------------------

function hasWindow(): boolean {
  try {
    return typeof window !== 'undefined';
  } catch {
    return false;
  }
}

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function hasLocalStorage(): boolean {
  try {
    return hasWindow() && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dexie (optional dependency) — lazy, cached singleton
// ---------------------------------------------------------------------------

type AnyDb = any;

/** Resolved to the live Dexie db, `null` (unavailable), or `undefined` (not yet probed). */
let dexieDbPromise: Promise<AnyDb | null> | undefined;

/**
 * Lazily resolve a Dexie database instance.
 *
 * Returns `null` (cached) when Dexie isn't installed or IndexedDB is missing,
 * so subsequent calls fall through to the localStorage path with no overhead.
 */
function getDexieDb(): Promise<AnyDb | null> {
  if (dexieDbPromise) return dexieDbPromise;

  dexieDbPromise = (async (): Promise<AnyDb | null> => {
    if (!hasIndexedDb()) return null;
    try {
      // Non-literal specifier keeps `dexie` an optional dep — tsc compiles
      // without it and bundlers won't eagerly resolve it.
      const mod: AnyDb = await import(/* webpackIgnore: true */ ('dexie' as string)).catch(
        () => null,
      );
      if (!mod) return null;

      const Dexie: AnyDb = mod.default ?? mod.Dexie ?? mod;
      if (typeof Dexie !== 'function') return null;

      const db: AnyDb = new Dexie(DB_NAME);
      // Composite string primary keys ('key'); blob columns are off-index.
      db.version(1).stores({
        messages: 'key',
        bodies: 'key',
      });
      // `open()` is implicit on first access, but opening eagerly surfaces
      // unsupported-environment errors here where we can swallow them.
      await db.open();
      return db;
    } catch {
      return null;
    }
  })();

  return dexieDbPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Cache the message rows for a folder (read-through write).
 * Never throws.
 */
export async function cacheMessages(
  accountId: any,
  folder: any,
  rows: any[],
): Promise<void> {
  const key = messagesKey(accountId, folder);
  const record: any = { key, rows: rows ?? [], cachedAt: Date.now() };

  const db = await getDexieDb();
  if (db) {
    try {
      await db.table('messages').put(record);
      return;
    } catch {
      // Fall through to localStorage on any Dexie failure.
    }
  }

  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(lsMessagesKey(accountId, folder), JSON.stringify(record));
    } catch {
      // Quota / serialization errors are non-fatal for a cache.
    }
  }
}

/**
 * Read cached message rows for a folder.
 * Returns `null` on miss or when no store is available. Never throws.
 */
export async function getCachedMessages(
  accountId: any,
  folder: any,
): Promise<any[] | null> {
  const db = await getDexieDb();
  if (db) {
    try {
      const rec: any = await db.table('messages').get(messagesKey(accountId, folder));
      if (rec && Array.isArray(rec.rows)) return rec.rows;
    } catch {
      // Fall through to localStorage.
    }
  }

  if (hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(lsMessagesKey(accountId, folder));
      if (raw) {
        const rec: any = JSON.parse(raw);
        if (rec && Array.isArray(rec.rows)) return rec.rows;
      }
    } catch {
      // Corrupt entry — treat as a miss.
    }
  }

  return null;
}

/**
 * Cache a single message body (read-through write).
 * Never throws.
 */
export async function cacheBody(accountId: any, uid: any, body: any): Promise<void> {
  const key = bodyKey(accountId, uid);
  const record: any = { key, body: body ?? null, cachedAt: Date.now() };

  const db = await getDexieDb();
  if (db) {
    try {
      await db.table('bodies').put(record);
      return;
    } catch {
      // Fall through to localStorage.
    }
  }

  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(lsBodyKey(accountId, uid), JSON.stringify(record));
    } catch {
      // Non-fatal.
    }
  }
}

/**
 * Read a cached message body.
 * Returns `null` on miss or when no store is available. Never throws.
 */
export async function getCachedBody(accountId: any, uid: any): Promise<any | null> {
  const db = await getDexieDb();
  if (db) {
    try {
      const rec: any = await db.table('bodies').get(bodyKey(accountId, uid));
      if (rec && 'body' in rec) return rec.body ?? null;
    } catch {
      // Fall through to localStorage.
    }
  }

  if (hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(lsBodyKey(accountId, uid));
      if (raw) {
        const rec: any = JSON.parse(raw);
        if (rec && 'body' in rec) return rec.body ?? null;
      }
    } catch {
      // Corrupt entry — treat as a miss.
    }
  }

  return null;
}

/**
 * Drop every SabMail cache entry from both Dexie and localStorage.
 * Never throws.
 */
export async function clearSabmailCache(): Promise<void> {
  const db = await getDexieDb();
  if (db) {
    try {
      await Promise.all([db.table('messages').clear(), db.table('bodies').clear()]);
    } catch {
      // Non-fatal; still attempt the localStorage sweep below.
    }
  }

  if (hasLocalStorage()) {
    try {
      const ls = window.localStorage;
      const doomed: string[] = [];
      for (let i = 0; i < ls.length; i += 1) {
        const k = ls.key(i);
        if (k && k.startsWith(LS_PREFIX)) doomed.push(k);
      }
      for (const k of doomed) {
        try {
          ls.removeItem(k);
        } catch {
          // Skip individual failures.
        }
      }
    } catch {
      // Non-fatal.
    }
  }
}
