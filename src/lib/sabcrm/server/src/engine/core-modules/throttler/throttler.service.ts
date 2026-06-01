import 'server-only';

// PORT-NOTE: NestJS @Injectable service → plain exported functions.
// CacheStorageService (Redis) replaced with a simple in-memory Map that works
// for single-process Next.js. For multi-instance deployments wire a Redis
// client here and replace getCache/setCache accordingly.
// Behavior is identical to the original token-bucket algorithm.

import {
  ThrottlerException,
  ThrottlerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/core-modules/throttler/throttler.exception';

// ── Simple in-process cache (swap with Redis for multi-instance) ──────────────

type BucketEntry = { tokens: number; lastRefillAt: number };

const cache = new Map<string, BucketEntry>();

function cacheGet(key: string): BucketEntry | undefined {
  return cache.get(key);
}

function cacheSet(key: string, value: BucketEntry): void {
  cache.set(key, value);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAvailableTokensCount(
  key: string,
  maxTokens: number,
  timeWindow: number,
  now = Date.now(),
): Promise<number> {
  const refillRate = maxTokens / timeWindow;
  const entry = cacheGet(key) ?? { tokens: maxTokens, lastRefillAt: now };
  const { tokens, lastRefillAt } = entry;
  const refillAmount = Math.floor((now - lastRefillAt) * refillRate);
  return Math.min(tokens + refillAmount, maxTokens);
}

export async function tokenBucketThrottleOrThrow(
  key: string,
  tokensToConsume: number,
  maxTokens: number,
  timeWindow: number,
): Promise<number> {
  const now = Date.now();
  const availableTokens = await getAvailableTokensCount(
    key,
    maxTokens,
    timeWindow,
    now,
  );

  if (availableTokens < tokensToConsume) {
    throw new ThrottlerException(
      `Limit reached (${maxTokens} tokens per ${timeWindow} ms)`,
      ThrottlerExceptionCode.LIMIT_REACHED,
    );
  }

  cacheSet(key, { tokens: availableTokens - tokensToConsume, lastRefillAt: now });

  return availableTokens - tokensToConsume;
}

export async function consumeTokens(
  key: string,
  tokensToConsume: number,
  maxTokens: number,
  timeWindow: number,
): Promise<void> {
  const now = Date.now();
  const availableTokens = await getAvailableTokensCount(
    key,
    maxTokens,
    timeWindow,
    now,
  );

  cacheSet(key, { tokens: availableTokens - tokensToConsume, lastRefillAt: now });
}
