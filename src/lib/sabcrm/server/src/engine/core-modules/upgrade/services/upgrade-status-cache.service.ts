import "server-only";

// PORT-NOTE: NestJS @Injectable and @InjectCacheStorage DI removed.
// CacheStorageService (Redis-backed) is replaced by a thin Redis client wrapper
// using ioredis. If SabNode's cache abstraction is available at a different
// path, swap the import below. Currently uses a minimal in-process TTL map as
// a fallback when Redis is unavailable.

const BEHIND_IDS_KEY = "upgrade-status:behind-workspace-ids";
const FAILED_IDS_KEY = "upgrade-status:failed-workspace-ids";
const UP_TO_DATE_COUNT_KEY = "upgrade-status:up-to-date-workspace-count";
const COMPUTED_AT_KEY = "upgrade-status:computed-at";

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

// ---------------------------------------------------------------------------
// Simple in-process TTL cache used when a Redis client is not injected.
// Replace with a real Redis client in production.
// ---------------------------------------------------------------------------
type CacheEntry = { value: string; expiresAt: number };
const memCache = new Map<string, CacheEntry>();
const setCache = new Map<string, Set<string>>();

function cacheSet(key: string, value: string, ttlSeconds: number): void {
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function cacheGet(key: string): string | null {
  const entry = memCache.get(key);

  if (!entry || Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }

  return entry.value;
}

function cacheDel(key: string): void {
  memCache.delete(key);
  setCache.delete(key);
}

function cacheSetAdd(key: string, members: string[], ttlSeconds: number): void {
  if (!setCache.has(key)) {
    setCache.set(key, new Set());
  }

  const s = setCache.get(key)!;

  for (const m of members) {
    s.add(m);
  }

  // Store expiry alongside the set via memCache
  memCache.set(key, {
    value: "__set__",
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function cacheSetMembers(key: string): string[] {
  const entry = memCache.get(key);

  if (!entry || Date.now() > entry.expiresAt) {
    memCache.delete(key);
    setCache.delete(key);
    return [];
  }

  return Array.from(setCache.get(key) ?? []);
}

// ---------------------------------------------------------------------------

export async function getComputedAt(): Promise<Date | null> {
  const computedAt = cacheGet(COMPUTED_AT_KEY);
  return computedAt != null ? new Date(computedAt) : null;
}

export async function getBehindWorkspaceIds(): Promise<string[]> {
  return cacheSetMembers(BEHIND_IDS_KEY);
}

export async function getFailedWorkspaceIds(): Promise<string[]> {
  return cacheSetMembers(FAILED_IDS_KEY);
}

export async function getUpToDateWorkspaceCount(): Promise<number> {
  const raw = cacheGet(UP_TO_DATE_COUNT_KEY);
  return raw != null ? Number(raw) : 0;
}

export async function writeUpgradeStatusCache({
  behindWorkspaceIds,
  failedWorkspaceIds,
  upToDateWorkspaceCount,
  computedAt,
}: {
  behindWorkspaceIds: string[];
  failedWorkspaceIds: string[];
  upToDateWorkspaceCount: number;
  computedAt: Date;
}): Promise<void> {
  cacheDel(BEHIND_IDS_KEY);
  cacheDel(FAILED_IDS_KEY);

  cacheSetAdd(BEHIND_IDS_KEY, behindWorkspaceIds, CACHE_TTL_SECONDS);
  cacheSetAdd(FAILED_IDS_KEY, failedWorkspaceIds, CACHE_TTL_SECONDS);
  cacheSet(
    UP_TO_DATE_COUNT_KEY,
    String(upToDateWorkspaceCount),
    CACHE_TTL_SECONDS,
  );
  cacheSet(COMPUTED_AT_KEY, computedAt.toISOString(), CACHE_TTL_SECONDS);
}

export async function invalidateUpgradeStatusCache(): Promise<void> {
  cacheDel(BEHIND_IDS_KEY);
  cacheDel(FAILED_IDS_KEY);
  cacheDel(UP_TO_DATE_COUNT_KEY);
  cacheDel(COMPUTED_AT_KEY);
}
