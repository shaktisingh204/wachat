'use client';
/**
 * SabFlow editor — `useCrdtNodes` React hook.
 *
 * Track A · Phase 6 · sub-task #1 of 10. Sibling of `./crdt-nodes.ts`.
 *
 * What this owns
 * --------------
 * Subscribes to `doc.getArray('blocks').observeDeep` and exposes the
 * freshly-materialised `Block[]` to React. Backed by `useSyncExternalStore`
 * so the React 19 concurrent renderer reads a consistent snapshot across
 * tearing-prone passes (an effect-based `useState` + `useEffect` would
 * occasionally render with a snapshot from the previous commit during
 * `startTransition` work — `useSyncExternalStore` is the contracted fix).
 *
 * Phase 6 sub-task #6 will rewire `EditorPage.tsx` to consume this hook in
 * place of the current `useState(initialFlow)`. Until then this hook is
 * not yet wired into the rendered tree; it ships now so the rest of Phase 6
 * (edges adapter, viewport adapter, settings panel adapter, etc.) has a
 * stable read surface to compose against.
 *
 * Yjs is forward-declared via the {@link YDocLike} shape re-used from
 * `./crdt-nodes.ts` — no static `yjs` import in this file.
 */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Block } from '@/lib/sabflow/types';
import {
  BLOCKS_ARRAY_KEY,
  getNodes,
  type YArrayLike,
  type YDocLike,
} from './crdt-nodes';

// ---------------------------------------------------------------------------
// Empty-snapshot sentinel
// ---------------------------------------------------------------------------

/**
 * Shared empty snapshot for the `doc === null` case. Returning the SAME array
 * reference every render is critical: `useSyncExternalStore` bails out on
 * `Object.is` equality, and a fresh `[]` on every call would cause an
 * infinite render loop (React's stated invariant — see
 * https://react.dev/reference/react/useSyncExternalStore#caveats).
 */
const EMPTY_BLOCKS: readonly Block[] = Object.freeze([]);

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to the block list of a SabFlow CRDT doc.
 *
 * Returns the latest `Block[]` snapshot. Re-renders only when the underlying
 * `Y.Array<Block>` (or any descendant) changes — co-edits, local inserts,
 * drag-reorders, and per-block field patches all funnel through
 * `observeDeep` so a single subscription covers every mutation path.
 *
 * Snapshot identity: each `observeDeep` event triggers a fresh `getNodes()`
 * pass (Yjs deep-clones plain-JSON entries on read, so the returned array
 * elements are themselves fresh objects). We cache the result in a ref and
 * `useSyncExternalStore` uses `Object.is` against that cached reference —
 * so an event that produces a non-changing block list still yields a stable
 * snapshot (Yjs may fire observeDeep for awareness-only deltas in rare cases).
 *
 * @param doc  Y.Doc returned by `useSabFlowDoc(flowId)`. `null` while the
 *             doc is still being fetched / hydrated; the hook returns the
 *             shared {@link EMPTY_BLOCKS} sentinel in that case.
 */
export function useCrdtNodes(doc: YDocLike | null): readonly Block[] {
  /**
   * Cached materialised snapshot. We keep this in a ref (not state) because
   * `useSyncExternalStore` calls `getSnapshot` synchronously during render —
   * mutating React state from inside that callback would violate the rules
   * of hooks. The ref is read inside `getSnapshot` and written by the
   * `observeDeep` handler (via the subscribe callback below).
   */
  const cacheRef = useRef<readonly Block[] | null>(null);

  /**
   * Stable reference to the blocks Y.Array for the current `doc`. Recomputed
   * only when `doc` changes (the Y.Array identity is stable for the lifetime
   * of a Y.Doc — `getArray(name)` returns the same instance on subsequent
   * calls). Memoising here lets the `subscribe`/`getSnapshot` callbacks below
   * stay referentially stable across renders, which is what
   * `useSyncExternalStore` keys off to avoid re-subscribing on every render.
   */
  const arr = useMemo<YArrayLike<Block> | null>(
    () => (doc ? doc.getArray<Block>(BLOCKS_ARRAY_KEY) : null),
    [doc],
  );

  /**
   * Recompute and cache the snapshot. Called on initial mount and after every
   * `observeDeep` event. We materialise unconditionally (no diff vs cache);
   * `observeDeep` only fires on real changes so over-rendering is bounded.
   */
  const refresh = useCallback(() => {
    if (!doc) {
      cacheRef.current = EMPTY_BLOCKS;
      return;
    }
    cacheRef.current = getNodes(doc);
  }, [doc]);

  /**
   * `useSyncExternalStore` `subscribe` callback. React calls this with a
   * notify function: we wire it to `observeDeep` so React schedules a
   * re-read whenever the Y.Array (or any descendant) changes.
   *
   * Must return a teardown that detaches the listener; we use
   * `unobserveDeep` with the same handler reference.
   */
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!arr) {
        // No doc yet → no source to observe. React will re-subscribe when
        // `doc` (and therefore `arr`) changes, because `subscribe` itself
        // changes identity (closes over `arr`).
        return () => {};
      }
      const handler = () => {
        refresh();
        notify();
      };
      // Prime the cache so the first `getSnapshot` after a re-subscribe
      // (e.g. when `doc` resolves) returns a consistent value with what
      // the just-attached observer will report on its next fire.
      refresh();
      arr.observeDeep(handler);
      return () => {
        arr.unobserveDeep(handler);
      };
    },
    [arr, refresh],
  );

  /**
   * `useSyncExternalStore` `getSnapshot`. Returns the cached snapshot,
   * computing it lazily on first read. After mount, `subscribe` keeps the
   * cache fresh, so this is a pure ref-read on the hot path.
   *
   * Stability contract: returning the same reference twice in a row tells
   * React there's nothing new to render. The cache is only mutated from
   * the observer handler, which is what we want.
   */
  const getSnapshot = useCallback((): readonly Block[] => {
    if (cacheRef.current === null) refresh();
    return cacheRef.current ?? EMPTY_BLOCKS;
  }, [refresh]);

  /**
   * Server snapshot — used by RSC streaming. The editor is `'use client'`
   * but the hook may still be evaluated server-side during the initial RSC
   * pass; returning the empty sentinel matches the "no doc yet" client
   * behaviour and avoids hydration mismatches. (See the rendering-hydration
   * rules in `react-best-practices` AGENTS.md.)
   */
  const getServerSnapshot = useCallback((): readonly Block[] => EMPTY_BLOCKS, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
