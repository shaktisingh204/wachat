/**
 * In-memory TTL cache for sub-workflow results.
 *
 * Wraps the `execute_workflow` forge block so repeated invocations with the
 * same `(workflowId, inputs)` skip the actual sub-flow run.  Opt-in: caller
 * sets `cacheTtlSeconds` on the block options.  Cache hits are observable —
 * the returned `outputs` carries `cached: true` and a `cachedAt` timestamp.
 *
 * Per-process, in-memory.  For multi-instance deployments swap for a
 * Redis-backed implementation; the public API is identical.
 */

import { createHash } from 'crypto';

type CacheEntry = {
  value: Record<string, unknown>;
  expiresAt: number;
};

const CACHE = new Map<string, CacheEntry>();
const MAX_ENTRIES = 1000;

/**
 * Build a deterministic key for `(workflowId, inputs, userId)`.  Includes
 * userId so two workspaces can't cross-pollute each other's cache.
 */
export function makeCacheKey(
  workflowId: string,
  userId: string,
  inputs: Record<string, unknown>,
): string {
  let body: string;
  try {
    body = JSON.stringify({ workflowId, userId, inputs });
  } catch {
    body = `${workflowId}|${userId}|${String(inputs)}`;
  }
  return createHash('sha256').update(body).digest('hex');
}

export function cacheGet(key: string): Record<string, unknown> | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    CACHE.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(
  key: string,
  value: Record<string, unknown>,
  ttlMs: number,
): void {
  if (ttlMs <= 0) return;
  // Evict the oldest entry when the cache grows too large.  Cheap LRU-ish
  // via Map iteration order (insertion-ordered).
  if (CACHE.size >= MAX_ENTRIES) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey !== undefined) CACHE.delete(firstKey);
  }
  CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Reset — tests / hot-reload only. */
export function resetSubWorkflowCache(): void {
  CACHE.clear();
}

/** Stats — observability. */
export function describeSubWorkflowCache(): {
  size: number;
  maxEntries: number;
} {
  return { size: CACHE.size, maxEntries: MAX_ENTRIES };
}
