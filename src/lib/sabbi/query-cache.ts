import 'server-only';

/**
 * SabBI MetricQuery result cache — a small in-process TTL cache.
 *
 * Keyed by the active workspace (project) + the query shape, so it is
 * RBAC-safe by construction: a cache hit can only ever return a result the
 * caller's own project already computed. A short TTL keeps dashboards/boards/
 * the copilot snappy (repeated identical card queries) without serving stale
 * data for long. Per-process (PM2 worker / serverless instance); not shared
 * across instances — that's fine for a read-through cache.
 */

const TTL_MS = 30_000;
const MAX_ENTRIES = 500;

interface Entry {
  at: number;
  value: unknown;
}

const store = new Map<string, Entry>();

export function cacheKey(workspaceId: string | null, query: unknown): string {
  return `mq:${workspaceId ?? 'anon'}:${JSON.stringify(query)}`;
}

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet(key: string, value: unknown): void {
  // Bounded: evict the oldest entry when full (insertion-order Map).
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { at: Date.now(), value });
}
