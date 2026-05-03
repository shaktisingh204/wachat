/**
 * Backlink monitoring & lost-link detection.
 *
 * `monitorBacklinks(domain)` returns the current snapshot from a pluggable
 * backlink provider. `diffBacklinks(prev, next)` returns lost / new links
 * so a poller can fire alerts.
 */
import type { Backlink } from './types';

export interface BacklinkAdapter {
  fetch(domain: string): Promise<Backlink[]>;
}

let activeAdapter: BacklinkAdapter | null = null;
export function setBacklinkAdapter(a: BacklinkAdapter | null): void {
  activeAdapter = a;
}

export async function monitorBacklinks(domain: string): Promise<Backlink[]> {
  const adapter = activeAdapter ?? defaultAdapter;
  return adapter.fetch(domain);
}

const defaultAdapter: BacklinkAdapter = {
  async fetch(domain) {
    try {
      const res = await fetch('/api/seo-tools/backlinks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { backlinks?: Backlink[] };
      return Array.isArray(data.backlinks) ? data.backlinks : [];
    } catch {
      return [];
    }
  },
};

export type BacklinkDiff = {
  newLinks: Backlink[];
  lostLinks: Backlink[];
  /** Links that flipped from follow → nofollow or vice versa. */
  changed: Backlink[];
};

export function diffBacklinks(prev: Backlink[], next: Backlink[]): BacklinkDiff {
  const key = (b: Backlink) => `${b.sourceUrl}=>${b.targetUrl}`;
  const prevMap = new Map(prev.map((b) => [key(b), b]));
  const nextMap = new Map(next.map((b) => [key(b), b]));

  const newLinks: Backlink[] = [];
  const lostLinks: Backlink[] = [];
  const changed: Backlink[] = [];

  for (const [k, b] of nextMap) {
    const before = prevMap.get(k);
    if (!before) {
      newLinks.push(b);
    } else if (before.rel !== b.rel || before.anchorText !== b.anchorText) {
      changed.push(b);
    }
  }
  for (const [k, b] of prevMap) {
    if (!nextMap.has(k)) {
      lostLinks.push({ ...b, status: 'lost', lastSeen: b.lastSeen });
    }
  }
  return { newLinks, lostLinks, changed };
}

/**
 * Convenience wrapper: fetch a fresh snapshot, diff it against `previous`,
 * and return both the new snapshot and the diff. Suitable for a cron poller.
 */
export async function pollBacklinks(
  domain: string,
  previous: Backlink[],
): Promise<{ snapshot: Backlink[]; diff: BacklinkDiff }> {
  const snapshot = await monitorBacklinks(domain);
  const diff = diffBacklinks(previous, snapshot);
  return { snapshot, diff };
}
