/**
 * SabNode Developer Platform — Idempotency-Key cache.
 *
 * Implements the Stripe-style `Idempotency-Key` header semantics:
 *
 *   - First request with `(tenantId, key)` runs the handler and caches
 *     the resulting status + body + JSON for `IDEMPOTENCY_TTL_SECONDS`.
 *   - A replay with the same key + same body returns the cached response.
 *   - A replay with the same key but a *different* body fails with 409
 *     (`idempotency_conflict`) so callers cannot accidentally double-spend
 *     by mutating the payload.
 *   - A replay arriving while the original is still in flight yields a
 *     409 too (we hold a Redis lock during the work).  Callers should
 *     retry after a short backoff.
 *
 * The Redis schema is two keys per logical idempotency record:
 *
 *   idem:lock:<tenant>:<key>          string, NX-locked, TTL = LOCK_TTL
 *   idem:result:<tenant>:<key>        JSON,   TTL = RESULT_TTL
 *
 * Storage is *fail-open* on Redis outages — we'd rather process a write
 * than 500 the entire API surface — but each fail-open is logged loudly.
 */

import 'server-only';

import { createHash } from 'node:crypto';
import Redis from 'ioredis';

import { ApiError } from './errors';

/* ── Tunables ───────────────────────────────────────────────────────────── */

/** How long a successful response stays replayable. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
/** How long the in-flight lock is held before being considered orphaned. */
export const IDEMPOTENCY_LOCK_TTL_SECONDS = 60;

const LOCK_PREFIX = 'idem:lock:';
const RESULT_PREFIX = 'idem:result:';

/* ── Redis client ───────────────────────────────────────────────────────── */

let client: Redis | null = null;

function getRedis(): Redis {
  if (client) return client;
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  client.on('error', (err) => {
    console.error('[api-platform.idempotency] redis error', err);
  });
  return client;
}

/* ── Public helpers ─────────────────────────────────────────────────────── */

/**
 * Stable digest of a request body — used to detect "same key, different
 * payload" replays.  `null`/`undefined`/non-stringifiable inputs produce
 * the empty digest so callers without a body don't trip the conflict
 * check.
 */
export function hashBody(body: unknown): string {
  if (body === undefined || body === null) return '';
  let serialised: string;
  try {
    serialised = typeof body === 'string' ? body : JSON.stringify(body);
  } catch {
    return '';
  }
  return createHash('sha256').update(serialised).digest('hex');
}

/** Cached representation of a prior response. */
export interface IdempotentRecord {
  status: number;
  /** Headers that should be re-applied on replay. */
  headers: Record<string, string>;
  /** Response body, JSON-encoded. */
  body: string;
  /** Digest of the original request body — replays must match. */
  bodyHash: string;
  /** ISO timestamp of the original processing. */
  storedAt: string;
}

/**
 * Look up a stored result.  Returns `null` if no record exists.
 *
 * Throws `ApiError.idempotencyConflict()` when a record exists but its
 * `bodyHash` differs from the supplied `bodyHash`.
 */
export async function lookupIdempotent(
  tenantId: string,
  key: string,
  bodyHash: string,
): Promise<IdempotentRecord | null> {
  if (!key) return null;
  try {
    const redis = getRedis();
    const raw = await redis.get(resultKey(tenantId, key));
    if (!raw) return null;
    const record = JSON.parse(raw) as IdempotentRecord;
    if (record.bodyHash && bodyHash && record.bodyHash !== bodyHash) {
      throw ApiError.idempotencyConflict(
        'Idempotency-Key was previously used with a different request body',
      );
    }
    return record;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[api-platform.idempotency] lookup fail-open', err);
    return null;
  }
}

/**
 * Try to acquire the in-flight lock.  Returns `true` when the caller is
 * the sole runner.  Returns `false` when a concurrent request is already
 * processing the same key — the caller should respond 409.
 *
 * Fails open on Redis outages.
 */
export async function acquireLock(tenantId: string, key: string): Promise<boolean> {
  if (!key) return true;
  try {
    const redis = getRedis();
    const setRes = await redis.set(
      lockKey(tenantId, key),
      '1',
      'EX',
      IDEMPOTENCY_LOCK_TTL_SECONDS,
      'NX',
    );
    return setRes === 'OK';
  } catch (err) {
    console.error('[api-platform.idempotency] lock fail-open', err);
    return true;
  }
}

/** Release a previously acquired lock. */
export async function releaseLock(tenantId: string, key: string): Promise<void> {
  if (!key) return;
  try {
    await getRedis().del(lockKey(tenantId, key));
  } catch (err) {
    console.error('[api-platform.idempotency] release fail-open', err);
  }
}

/**
 * Persist a response so future replays are short-circuited.  Must be
 * called after the handler completes (success or any final response).
 */
export async function storeIdempotent(
  tenantId: string,
  key: string,
  record: IdempotentRecord,
): Promise<void> {
  if (!key) return;
  try {
    const redis = getRedis();
    await redis.set(
      resultKey(tenantId, key),
      JSON.stringify(record),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    );
  } catch (err) {
    console.error('[api-platform.idempotency] store fail-open', err);
  }
}

/**
 * High-level helper: "if a cached result exists, return it; otherwise run
 * `produce` under a lock, cache its result, and return it".  Designed to
 * wrap a route-handler body.
 *
 * `produce` should return the canonical response object; we serialise it
 * to JSON for storage.  Headers passed in `produce`'s return value will
 * be re-applied on replay.
 */
export interface ProducedResult {
  status: number;
  headers?: Record<string, string>;
  /** Response payload — will be JSON.stringified. */
  body: unknown;
}

export async function withIdempotency<T extends ProducedResult>(
  tenantId: string,
  key: string | null | undefined,
  rawBody: unknown,
  produce: () => Promise<T>,
): Promise<{ status: number; headers: Record<string, string>; body: string; replayed: boolean }> {
  // No key — caller opted out.
  if (!key) {
    const out = await produce();
    return {
      status: out.status,
      headers: out.headers ?? {},
      body: JSON.stringify(out.body),
      replayed: false,
    };
  }

  const bodyHash = hashBody(rawBody);

  // 1. Cache hit?
  const cached = await lookupIdempotent(tenantId, key, bodyHash);
  if (cached) {
    return {
      status: cached.status,
      headers: { ...cached.headers, 'idempotency-replayed': 'true' },
      body: cached.body,
      replayed: true,
    };
  }

  // 2. Acquire the lock.
  const got = await acquireLock(tenantId, key);
  if (!got) {
    throw ApiError.idempotencyConflict(
      'Concurrent request with the same Idempotency-Key is in flight',
    );
  }

  try {
    const out = await produce();
    const record: IdempotentRecord = {
      status: out.status,
      headers: out.headers ?? {},
      body: JSON.stringify(out.body),
      bodyHash,
      storedAt: new Date().toISOString(),
    };
    await storeIdempotent(tenantId, key, record);
    return {
      status: record.status,
      headers: record.headers,
      body: record.body,
      replayed: false,
    };
  } finally {
    await releaseLock(tenantId, key);
  }
}

/* ── Internals ──────────────────────────────────────────────────────────── */

function lockKey(tenantId: string, key: string): string {
  return `${LOCK_PREFIX}${tenantId}:${key}`;
}

function resultKey(tenantId: string, key: string): string {
  return `${RESULT_PREFIX}${tenantId}:${key}`;
}

/**
 * Test-only helper — clears any in-memory client so tests can plug a
 * fake Redis via `__setRedisForTest`.  Not exported via the barrel.
 */
export function __setRedisForTest(fake: Redis | null): void {
  client = fake;
}
