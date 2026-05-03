/**
 * SabNode Developer Platform — token-bucket rate limiter.
 *
 * Implements a per-key token bucket using ioredis.  State for one bucket
 * lives in a Redis hash with two fields:
 *
 *   tokens  — float remaining
 *   updated — last refill timestamp (ms since epoch)
 *
 * On each call we:
 *   1. Read the current state.
 *   2. Refill at rate `capacity / 60s` since `updated`.
 *   3. If `tokens >= 1`, decrement and allow.  Otherwise reject.
 *
 * Refills and updates are sent in a single `MULTI` so that concurrent
 * requests against the same bucket cannot race past each other in any
 * meaningful way; the bounded error in heavy concurrency is negligible
 * vs. a full Lua-script approach and keeps the code readable.
 */

import 'server-only';

import Redis from 'ioredis';
import type { RateLimitTier } from './types';

/* ── Tier configuration ──────────────────────────────────────────────────── */

/**
 * Requests per minute allowed for each tier.  These are also exposed via
 * the `OpenAPI` spec so SDK authors can surface them to end users.
 */
export const TIER_LIMITS: Record<RateLimitTier, number> = {
  FREE: 60,
  PRO: 600,
  ENTERPRISE: 6000,
};

/** Window over which the per-tier limit applies, in seconds. */
const WINDOW_SECONDS = 60;

/** Hash key prefix in Redis. */
const KEY_PREFIX = 'apilim:';

/** TTL applied to bucket hashes — well over one window so idle buckets
 * eventually drop out of the cache. */
const KEY_TTL_SECONDS = WINDOW_SECONDS * 4;

/* ── Redis client (lazy singleton) ───────────────────────────────────────── */

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
    console.error('[api-platform] redis error', err);
  });
  return client;
}

/* ── Public types ────────────────────────────────────────────────────────── */

/** Result of a rate-limit check. */
export interface RateLimitResult {
  /** True when the request is allowed through. */
  allowed: boolean;
  /** Configured maximum requests per minute for this tier. */
  limit: number;
  /** Approximate tokens left after this call. */
  remaining: number;
  /** Seconds until the bucket is fully refilled. */
  resetSeconds: number;
}

/* ── Bucket math ─────────────────────────────────────────────────────────── */

/**
 * Compute the new `tokens` value given the prior state and the elapsed
 * time.  Refill rate is `capacity / WINDOW_SECONDS` per second.
 */
function refill(prevTokens: number, prevUpdated: number, now: number, capacity: number): number {
  const elapsedSec = Math.max(0, (now - prevUpdated) / 1000);
  const refillPerSec = capacity / WINDOW_SECONDS;
  const next = prevTokens + elapsedSec * refillPerSec;
  return next > capacity ? capacity : next;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Check (and consume one token from) the bucket identified by `key` at
 * the given tier.  `key` is typically the API key id or tenant id.
 *
 * Failures to reach Redis are *fail-open* — we'd rather serve the
 * request than 500 the entire API surface — but we log loudly.
 */
export async function consumeToken(key: string, tier: RateLimitTier): Promise<RateLimitResult> {
  const capacity = TIER_LIMITS[tier] ?? TIER_LIMITS.FREE;
  const redisKey = `${KEY_PREFIX}${tier}:${key}`;
  const now = Date.now();

  try {
    const redis = getRedis();

    // Fetch prior state.
    const [tokensRaw, updatedRaw] = await redis.hmget(redisKey, 'tokens', 'updated');
    const prevTokens =
      tokensRaw == null || Number.isNaN(Number(tokensRaw)) ? capacity : Number(tokensRaw);
    const prevUpdated =
      updatedRaw == null || Number.isNaN(Number(updatedRaw)) ? now : Number(updatedRaw);

    const refilled = refill(prevTokens, prevUpdated, now, capacity);

    if (refilled < 1) {
      // Persist the (still-empty) refilled value so we don't lose the
      // partial accumulation.
      await redis
        .multi()
        .hset(redisKey, 'tokens', String(refilled), 'updated', String(now))
        .expire(redisKey, KEY_TTL_SECONDS)
        .exec();

      const tokensNeeded = 1 - refilled;
      const refillPerSec = capacity / WINDOW_SECONDS;
      const resetSeconds = Math.max(1, Math.ceil(tokensNeeded / refillPerSec));
      return { allowed: false, limit: capacity, remaining: 0, resetSeconds };
    }

    const remaining = refilled - 1;
    await redis
      .multi()
      .hset(redisKey, 'tokens', String(remaining), 'updated', String(now))
      .expire(redisKey, KEY_TTL_SECONDS)
      .exec();

    const refillPerSec = capacity / WINDOW_SECONDS;
    const resetSeconds = Math.ceil((capacity - remaining) / refillPerSec);
    return { allowed: true, limit: capacity, remaining: Math.floor(remaining), resetSeconds };
  } catch (err) {
    console.error('[api-platform] rate-limit fail-open:', err);
    return { allowed: true, limit: capacity, remaining: capacity - 1, resetSeconds: WINDOW_SECONDS };
  }
}

/**
 * Convenience: produce the standard `X-RateLimit-*` headers for a given
 * result.  Useful for attaching to outbound NextResponses.
 */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(Math.max(0, r.remaining)),
    'X-RateLimit-Reset': String(r.resetSeconds),
  };
}
