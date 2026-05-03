/**
 * Rank tracking. Defines a `RankAdapter` interface so callers can plug in
 * the existing DataForSEO client (`src/lib/seo/data-for-seo-client.ts`) or
 * any other backend without coupling this module to a specific provider.
 */
import type { RankPosition } from './types';

export type TrackKeywordsParams = {
  keywords: string[];
  engine?: RankPosition['engine'];
  location: string;
  device?: RankPosition['device'];
  /** Optional target domain for relative ranking. */
  domain?: string;
};

export interface RankAdapter {
  fetchPositions(params: Required<Omit<TrackKeywordsParams, 'domain'>> & { domain?: string }): Promise<RankPosition[]>;
}

let activeAdapter: RankAdapter | null = null;

export function setRankAdapter(adapter: RankAdapter | null): void {
  activeAdapter = adapter;
}

export function getRankAdapter(): RankAdapter | null {
  return activeAdapter;
}

export async function trackKeywords(params: TrackKeywordsParams): Promise<RankPosition[]> {
  const engine = params.engine ?? 'google';
  const device = params.device ?? 'desktop';
  const adapter = activeAdapter ?? defaultAdapter;
  const positions = await adapter.fetchPositions({
    keywords: params.keywords,
    engine,
    location: params.location,
    device,
    domain: params.domain,
  });
  return positions;
}

/**
 * Adapter that posts to the existing seo-tools API surface. Real wiring lives
 * in the API route; this client just hits it. Falls back to an empty array
 * if the call fails so callers can degrade gracefully.
 */
const defaultAdapter: RankAdapter = {
  async fetchPositions({ keywords, engine, location, device, domain }) {
    try {
      // Defer fetch to runtime so non-browser callers (workers, tests) can
      // override via setRankAdapter without triggering DOM globals.
      const res = await fetch('/api/seo-tools/rank-track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords, engine, location, device, domain }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { positions?: RankPosition[] };
      return Array.isArray(data.positions) ? data.positions : [];
    } catch {
      return keywords.map((keyword) => ({
        keyword,
        engine,
        location,
        device,
        position: null,
        checkedAt: new Date().toISOString(),
      }));
    }
  },
};

/**
 * Compute rank deltas between two snapshots, keyed by keyword+engine+location+device.
 */
export function computeRankDeltas(prev: RankPosition[], next: RankPosition[]): RankPosition[] {
  const key = (p: RankPosition) => `${p.keyword}|${p.engine}|${p.location}|${p.device}`;
  const prevMap = new Map(prev.map((p) => [key(p), p]));
  return next.map((curr) => {
    const before = prevMap.get(key(curr));
    if (before?.position == null || curr.position == null) {
      return curr;
    }
    return { ...curr, change: before.position - curr.position };
  });
}
