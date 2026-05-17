/**
 * In-memory sliding-window rate limiter for SabFlow's v1 API.
 *
 * Single-process only — entries live in a module-level Map and are lost on
 * restart.  Suitable for per-API-key throttling on a single Node instance;
 * a Redis-backed store would be required for multi-instance deployments.
 *
 * Two windows are tracked per key:
 *   - minute:  precise sliding 60s window (array of timestamps)
 *   - hour:    coarse fixed 3600s bucket  (counter + reset timestamp)
 *
 * Stale entries (no activity in >1h) are garbage-collected lazily on each
 * call.  GC scans the whole map roughly every minute.
 */
type Entry = {
  minuteTimestamps: number[];
  hourCount: number;
  hourResetAt: number;
  lastSeen: number;
};

export type RateLimitOptions = {
  maxPerMinute: number;
  maxPerHour?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining: number;
  limit: number;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const GC_INTERVAL_MS = 60_000;

const DEFAULT_MAX_PER_MINUTE = 60;
const DEFAULT_MAX_PER_HOUR = 1000;

const store: Map<string, Entry> = new Map();
let lastGcAt = 0;

/**
 * Garbage-collect entries whose `lastSeen` is older than 1 hour.  Runs at
 * most once per `GC_INTERVAL_MS`.
 */
function maybeGc(now: number): void {
  if (now - lastGcAt < GC_INTERVAL_MS) return;
  lastGcAt = now;
  for (const [key, entry] of store) {
    if (now - entry.lastSeen > HOUR_MS) {
      store.delete(key);
    }
  }
}

/**
 * Check (and record) a request against the rate-limit windows for `key`.
 * Returns `{ allowed, retryAfterSeconds?, remaining, limit }`.
 *
 * When `allowed === false`, the caller should reject with 429 and pass
 * `retryAfterSeconds` to the client.  The minute window is always the
 * "limit" surfaced — that's the tighter of the two for short-burst clients.
 */
export function checkRateLimit(
  key: string,
  opts?: RateLimitOptions,
): RateLimitResult {
  const maxPerMinute = opts?.maxPerMinute ?? DEFAULT_MAX_PER_MINUTE;
  const maxPerHour = opts?.maxPerHour ?? DEFAULT_MAX_PER_HOUR;
  const now = Date.now();

  maybeGc(now);

  let entry = store.get(key);
  if (!entry) {
    entry = {
      minuteTimestamps: [],
      hourCount: 0,
      hourResetAt: now + HOUR_MS,
      lastSeen: now,
    };
    store.set(key, entry);
  }

  /* Prune timestamps that fell out of the 60s sliding window. */
  const minuteCutoff = now - MINUTE_MS;
  entry.minuteTimestamps = entry.minuteTimestamps.filter(
    (ts) => ts > minuteCutoff,
  );

  /* Reset the hour bucket if it expired. */
  if (now >= entry.hourResetAt) {
    entry.hourCount = 0;
    entry.hourResetAt = now + HOUR_MS;
  }

  entry.lastSeen = now;

  /* Hour-window check (coarse). */
  if (entry.hourCount >= maxPerHour) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.hourResetAt - now) / 1000),
    );
    return {
      allowed: false,
      retryAfterSeconds,
      remaining: 0,
      limit: maxPerMinute,
    };
  }

  /* Minute-window check (precise sliding). */
  if (entry.minuteTimestamps.length >= maxPerMinute) {
    const oldest = entry.minuteTimestamps[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + MINUTE_MS - now) / 1000),
    );
    return {
      allowed: false,
      retryAfterSeconds,
      remaining: 0,
      limit: maxPerMinute,
    };
  }

  /* Allowed — record the hit. */
  entry.minuteTimestamps.push(now);
  entry.hourCount += 1;

  return {
    allowed: true,
    remaining: Math.max(0, maxPerMinute - entry.minuteTimestamps.length),
    limit: maxPerMinute,
  };
}

/**
 * Test/maintenance helper — clear all rate-limit state.  Not exported via
 * the public middleware; callers reach for this only in tests.
 */
export function _resetRateLimitStore(): void {
  store.clear();
  lastGcAt = 0;
}
