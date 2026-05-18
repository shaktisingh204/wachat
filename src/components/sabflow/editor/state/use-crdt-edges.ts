/**
 * React binding for the CRDT-backed edge store.
 *
 * Backed by `useSyncExternalStore` so React renders only see committed Yjs
 * snapshots — no torn state, and no extra render on subscription.
 *
 * A per-doc snapshot cache keeps `getEdges` referentially stable between
 * commits (otherwise `useSyncExternalStore` would loop in concurrent mode).
 * The cache entry for a doc is invalidated by the array observer right before
 * React is told to re-read.
 */

import { useSyncExternalStore } from 'react';

import type { Edge } from '@/lib/sabflow/types';

import {
  getEdges,
  subscribeToEdges,
  type YDocLike,
} from './crdt-edges';

/* Per-doc snapshot cache (WeakMap so docs can be GC'd cleanly). */
const snapshotCache = new WeakMap<YDocLike, Edge[]>();

function readSnapshot(doc: YDocLike): Edge[] {
  const cached = snapshotCache.get(doc);
  if (cached) return cached;
  const fresh = getEdges(doc);
  snapshotCache.set(doc, fresh);
  return fresh;
}

function invalidateSnapshot(doc: YDocLike): void {
  snapshotCache.delete(doc);
}

/** Stable empty snapshot for the SSR / pre-hydration code path. */
const EMPTY_SERVER_SNAPSHOT: Edge[] = Object.freeze([]) as unknown as Edge[];

/**
 * Subscribe a component to the edges of `doc`. Re-renders whenever a
 * transaction commits that touches the edges array, regardless of origin.
 *
 * Accepts `doc | null | undefined` so consumers can render before the
 * provider has mounted the doc — they receive an empty snapshot in that case.
 */
export function useCrdtEdges(doc: YDocLike | null | undefined): Edge[] {
  return useSyncExternalStore<Edge[]>(
    (onStoreChange) => {
      if (!doc) return () => {};
      return subscribeToEdges(doc, () => {
        invalidateSnapshot(doc);
        onStoreChange();
      });
    },
    () => (doc ? readSnapshot(doc) : EMPTY_SERVER_SNAPSHOT),
    () => EMPTY_SERVER_SNAPSHOT,
  );
}
