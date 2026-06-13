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
      // v2 adds the optimistic-write mutation queue (`id` primary key,
      // `createdAt` index for FIFO drain).
      db.version(2).stores({
        messages: 'key',
        bodies: 'key',
        mutations: 'id, createdAt',
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

// ---------------------------------------------------------------------------
// Optimistic-write mutation queue (Superhuman "modify() + persist()" model)
// ---------------------------------------------------------------------------

/** A queued inbox mutation: applied to the UI/cache instantly, persisted async. */
export interface SabmailMutation {
  /** Stable client id (also the Dexie/localStorage primary key). */
  id: string;
  /** What changed — the runner maps this to a server action. */
  type: 'markSeen' | 'markUnseen' | 'flag' | 'unflag' | 'archive' | 'delete' | string;
  accountId: string;
  folder: string;
  uid: number;
  /** Optional extra args for the server action (e.g. target folder). */
  payload?: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

const LS_MUTATIONS_KEY = `${LS_PREFIX}mutations`;

/** Best-effort id generator (crypto.randomUUID when present, else timestamp+rand). */
function newMutationId(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return String(c.randomUUID());
  } catch {
    /* fall through */
  }
  return `m_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function readLsMutations(): SabmailMutation[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LS_MUTATIONS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as SabmailMutation[]) : [];
  } catch {
    return [];
  }
}

function writeLsMutations(list: SabmailMutation[]): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(LS_MUTATIONS_KEY, JSON.stringify(list));
  } catch {
    /* quota — non-fatal */
  }
}

/**
 * Enqueue a mutation for async persistence. Returns the full record (with its
 * generated id). Never throws.
 */
export async function enqueueMutation(
  input: Omit<SabmailMutation, 'id' | 'createdAt' | 'attempts'> &
    Partial<Pick<SabmailMutation, 'id' | 'createdAt' | 'attempts'>>,
): Promise<SabmailMutation> {
  const record: SabmailMutation = {
    id: input.id ?? newMutationId(),
    type: input.type,
    accountId: String(input.accountId),
    folder: String(input.folder),
    uid: Number(input.uid),
    payload: input.payload,
    createdAt: input.createdAt ?? Date.now(),
    attempts: input.attempts ?? 0,
  };

  const db = await getDexieDb();
  if (db) {
    try {
      await db.table('mutations').put(record);
      return record;
    } catch {
      // Fall through to localStorage.
    }
  }
  const list = readLsMutations();
  list.push(record);
  writeLsMutations(list);
  return record;
}

/** List queued mutations, oldest first. Never throws. */
export async function listQueuedMutations(): Promise<SabmailMutation[]> {
  const db = await getDexieDb();
  if (db) {
    try {
      const all: SabmailMutation[] = await db.table('mutations').toArray();
      return all.sort((a, b) => a.createdAt - b.createdAt);
    } catch {
      // Fall through to localStorage.
    }
  }
  return readLsMutations().sort((a, b) => a.createdAt - b.createdAt);
}

/** Remove a mutation from the queue (after success or terminal failure). */
export async function removeMutation(id: string): Promise<void> {
  const db = await getDexieDb();
  if (db) {
    try {
      await db.table('mutations').delete(id);
      return;
    } catch {
      // Fall through to localStorage.
    }
  }
  writeLsMutations(readLsMutations().filter((m) => m.id !== id));
}

/** Record a failed attempt (for backoff / max-retry decisions). */
export async function bumpMutationAttempt(id: string): Promise<number> {
  const db = await getDexieDb();
  if (db) {
    try {
      const rec: SabmailMutation | undefined = await db.table('mutations').get(id);
      if (rec) {
        rec.attempts = (rec.attempts ?? 0) + 1;
        await db.table('mutations').put(rec);
        return rec.attempts;
      }
      return 0;
    } catch {
      // Fall through to localStorage.
    }
  }
  const list = readLsMutations();
  const rec = list.find((m) => m.id === id);
  if (!rec) return 0;
  rec.attempts = (rec.attempts ?? 0) + 1;
  writeLsMutations(list);
  return rec.attempts;
}

export interface FlushMutationsResult {
  flushed: number;
  failed: SabmailMutation[];
}

/** Outcome a runner returns for one mutation. */
export type MutationRunResult =
  | { ok: true }
  | { ok: false; retry: boolean };

/**
 * Drain the queue through `runner` (which performs the real server write).
 *   - `{ ok: true }`            → remove the mutation (reconciled).
 *   - `{ ok: false, retry:true}`→ keep it (bump attempts) up to `maxAttempts`,
 *                                  then drop it and report it as failed so the
 *                                  caller can roll the optimistic edit back.
 *   - `{ ok: false, retry:false}`→ terminal: drop + report failed (rollback).
 * Never throws; returns the failed set for rollback/reconcile.
 */
export async function flushMutations(
  runner: (m: SabmailMutation) => Promise<MutationRunResult>,
  opts: { maxAttempts?: number } = {},
): Promise<FlushMutationsResult> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const queued = await listQueuedMutations();
  let flushed = 0;
  const failed: SabmailMutation[] = [];

  for (const m of queued) {
    let res: MutationRunResult;
    try {
      res = await runner(m);
    } catch {
      res = { ok: false, retry: true };
    }

    if (res.ok) {
      await removeMutation(m.id);
      flushed += 1;
      continue;
    }
    if (res.retry) {
      const attempts = await bumpMutationAttempt(m.id);
      if (attempts >= maxAttempts) {
        await removeMutation(m.id);
        failed.push({ ...m, attempts });
      }
      // else leave it queued for the next flush.
    } else {
      await removeMutation(m.id);
      failed.push(m);
    }
  }

  return { flushed, failed };
}

/**
 * Optimistically patch one cached row in a folder list and return the previous
 * row snapshot (for rollback). Returns `null` when the row isn't cached. Never
 * throws — the optimistic UI update itself is the source of truth; this just
 * keeps the read-through cache consistent so a refresh doesn't flicker back.
 */
export async function patchCachedRow(
  accountId: any,
  folder: any,
  uid: any,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const rows = await getCachedMessages(accountId, folder);
  if (!rows) return null;
  const idx = rows.findIndex((r: any) => Number(r?.uid) === Number(uid));
  if (idx < 0) return null;
  const prev = { ...rows[idx] };
  rows[idx] = { ...rows[idx], ...patch };
  await cacheMessages(accountId, folder, rows);
  return prev;
}

/**
 * Optimistically remove a cached row (archive/delete) and return it for
 * rollback. Returns `null` when not cached. Never throws.
 */
export async function removeCachedRow(
  accountId: any,
  folder: any,
  uid: any,
): Promise<Record<string, unknown> | null> {
  const rows = await getCachedMessages(accountId, folder);
  if (!rows) return null;
  const idx = rows.findIndex((r: any) => Number(r?.uid) === Number(uid));
  if (idx < 0) return null;
  const [removed] = rows.splice(idx, 1);
  await cacheMessages(accountId, folder, rows);
  return removed ?? null;
}

/**
 * Drop every SabMail cache entry from both Dexie and localStorage.
 * Never throws.
 */
export async function clearSabmailCache(): Promise<void> {
  const db = await getDexieDb();
  if (db) {
    try {
      await Promise.all([
        db.table('messages').clear(),
        db.table('bodies').clear(),
        db.table('mutations').clear(),
      ]);
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
