/**
 * SabFlow — App preset client helpers.
 *
 * Tiny in-memory SWR-style cache for the picker / settings panel surfaces.
 * Caches both the summary list and per-id full preset bodies; entries
 * revalidate after 5 minutes (or on explicit `invalidate*` calls).
 *
 * Safe to import from client components — no `server-only`, no node imports.
 */

import type { AppPreset, AppPresetSummary } from './types';

const TTL_MS = 5 * 60 * 1000;

type SummaryCache = {
  data: AppPresetSummary[];
  expiresAt: number;
  inflight?: Promise<AppPresetSummary[]>;
};

type PresetCacheEntry = {
  data: AppPreset | undefined;
  expiresAt: number;
  inflight?: Promise<AppPreset | undefined>;
};

let summaryCache: SummaryCache | null = null;
const presetCache = new Map<string, PresetCacheEntry>();

/** Force-refresh the summary cache on the next call. */
export function invalidatePresetSummaries(): void {
  summaryCache = null;
}

/** Force-refresh a specific preset on the next call. */
export function invalidatePreset(id: string): void {
  presetCache.delete(id);
}

/**
 * Fetch (and cache) the picker summary list.
 * Coalesces concurrent calls onto a single in-flight request.
 */
export async function fetchPresetSummaries(): Promise<AppPresetSummary[]> {
  const now = Date.now();
  if (summaryCache && summaryCache.expiresAt > now) return summaryCache.data;
  if (summaryCache?.inflight) return summaryCache.inflight;

  const inflight = (async () => {
    const res = await fetch('/api/sabflow/app-presets', { cache: 'no-store' });
    if (!res.ok) {
      // Don't poison the cache on transient errors — return empty so the UI
      // can show a fallback. Next call will re-attempt.
      summaryCache = null;
      return [] as AppPresetSummary[];
    }
    const json = (await res.json()) as { presets?: AppPresetSummary[] };
    const data = json.presets ?? [];
    summaryCache = { data, expiresAt: Date.now() + TTL_MS };
    return data;
  })();

  summaryCache = { data: [], expiresAt: 0, inflight };
  return inflight;
}

/**
 * Fetch (and cache) a single preset. Returns `undefined` for 404 / errors.
 */
export async function fetchPreset(id: string): Promise<AppPreset | undefined> {
  if (!id) return undefined;
  const now = Date.now();
  const cached = presetCache.get(id);
  if (cached && cached.expiresAt > now) return cached.data;
  if (cached?.inflight) return cached.inflight;

  const inflight = (async () => {
    const res = await fetch(`/api/sabflow/app-presets/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      // 404 — cache the negative result briefly so we don't hammer the route.
      presetCache.set(id, { data: undefined, expiresAt: Date.now() + 30_000 });
      return undefined;
    }
    const data = (await res.json()) as AppPreset;
    presetCache.set(id, { data, expiresAt: Date.now() + TTL_MS });
    return data;
  })();

  presetCache.set(id, { data: undefined, expiresAt: 0, inflight });
  return inflight;
}
