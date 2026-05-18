/**
 * CRDT-backed edge store for the SabFlow editor.
 *
 * Track A Phase 6 — replaces local edge state with a `Y.Array<Edge>` on a
 * shared `Y.Doc`. All mutations are wrapped in a transaction with an explicit
 * `origin` so observers can route updates (local vs. remote vs. system).
 *
 * Y types are forward-declared (a minimal structural shape of what we touch)
 * to avoid taking a hard build-time dependency on the `yjs` package until the
 * provider is wired in.  Any real `yjs` Doc/Array satisfies the same surface,
 * so call sites can pass through `Y.Doc` instances directly.
 *
 * Companion files:
 *   - crdt-blocks.ts   — sibling Y.Map<Block> store
 *   - use-crdt-edges.ts — React binding via useSyncExternalStore
 */

import type { Edge } from '@/lib/sabflow/types';

/* ─────────────────────────────────────────────────────────────────────────
 * Transaction origins
 * ──────────────────────────────────────────────────────────────────────── */

/** Origin tag for mutations made by the local user via the editor UI. */
export const SABFLOW_LOCAL_ORIGIN = Symbol.for('sabflow.local');

/** Origin tag for mutations made by internal housekeeping (e.g. cleanup). */
export const SABFLOW_SYSTEM_ORIGIN = Symbol.for('sabflow.system');

export type SabFlowOrigin = typeof SABFLOW_LOCAL_ORIGIN | typeof SABFLOW_SYSTEM_ORIGIN | unknown;

/* ─────────────────────────────────────────────────────────────────────────
 * Forward-declared Y types — structural subset of `yjs` we rely on.
 * Any real `Y.Doc` / `Y.Array` / `Y.Map` is assignable to these.
 * ──────────────────────────────────────────────────────────────────────── */

export interface YEvent {
  readonly transaction: { readonly origin: unknown };
}

export interface YArrayLike<T> {
  readonly length: number;
  toArray(): T[];
  push(items: T[]): void;
  insert(index: number, items: T[]): void;
  delete(index: number, length?: number): void;
  get(index: number): T;
  observe(handler: (event: YEvent) => void): void;
  unobserve(handler: (event: YEvent) => void): void;
}

export interface YMapLike<T> {
  has(key: string): boolean;
  get(key: string): T | undefined;
  observe(handler: (event: YEvent) => void): void;
  unobserve(handler: (event: YEvent) => void): void;
}

export interface YDocLike {
  getArray<T>(name: string): YArrayLike<T>;
  getMap<T>(name: string): YMapLike<T>;
  transact(fn: () => void, origin?: unknown): void;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────────────────── */

const EDGES_ARRAY = 'edges';
const BLOCKS_MAP = 'blocks';

/* ─────────────────────────────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────────────────────────────── */

function getEdgesArray(doc: YDocLike): YArrayLike<Edge> {
  return doc.getArray<Edge>(EDGES_ARRAY);
}

function getBlocksMap(doc: YDocLike): YMapLike<unknown> {
  return doc.getMap<unknown>(BLOCKS_MAP);
}

function indexOfEdge(arr: YArrayLike<Edge>, id: string): number {
  const len = arr.length;
  for (let i = 0; i < len; i++) {
    if (arr.get(i)?.id === id) return i;
  }
  return -1;
}

/**
 * An edge references valid blocks when, for every block id mentioned in its
 * `from` / `to` endpoints, that block id exists in the shared blocks map.
 * `eventId` / `groupId` / `itemId` / `pinId` are intentionally not validated
 * here — only `blockId` references are guarded.
 */
function edgeReferencesValidBlocks(edge: Edge, blocks: YMapLike<unknown>): boolean {
  const fromBlockId = (edge.from as { blockId?: string })?.blockId;
  if (fromBlockId !== undefined && !blocks.has(fromBlockId)) return false;
  const toBlockId = edge.to?.blockId;
  if (toBlockId !== undefined && !blocks.has(toBlockId)) return false;
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Public read API
 * ──────────────────────────────────────────────────────────────────────── */

/** Snapshot of all edges in the document, in insertion order. */
export function getEdges(doc: YDocLike): Edge[] {
  return getEdgesArray(doc).toArray();
}

/* ─────────────────────────────────────────────────────────────────────────
 * Public write API — all transacted, with `origin` defaulting to local.
 * ──────────────────────────────────────────────────────────────────────── */

/** Append a new edge.  Idempotent on `edge.id`. */
export function addEdge(doc: YDocLike, edge: Edge, origin: SabFlowOrigin = SABFLOW_LOCAL_ORIGIN): void {
  doc.transact(() => {
    const arr = getEdgesArray(doc);
    if (indexOfEdge(arr, edge.id) >= 0) return;
    arr.push([edge]);
  }, origin);
}

/** Remove an edge by id.  No-op if the id isn't present. */
export function removeEdge(
  doc: YDocLike,
  edgeId: string,
  origin: SabFlowOrigin = SABFLOW_LOCAL_ORIGIN,
): void {
  doc.transact(() => {
    const arr = getEdgesArray(doc);
    const idx = indexOfEdge(arr, edgeId);
    if (idx < 0) return;
    arr.delete(idx, 1);
  }, origin);
}

/**
 * Patch an edge in place by replacing it with `{ ...existing, ...patch, id }`.
 * The `id` field is preserved even if present in `patch`.
 */
export function updateEdge(
  doc: YDocLike,
  edgeId: string,
  patch: Partial<Edge>,
  origin: SabFlowOrigin = SABFLOW_LOCAL_ORIGIN,
): void {
  doc.transact(() => {
    const arr = getEdgesArray(doc);
    const idx = indexOfEdge(arr, edgeId);
    if (idx < 0) return;
    const current = arr.get(idx);
    const next: Edge = { ...current, ...patch, id: edgeId } as Edge;
    arr.delete(idx, 1);
    arr.insert(idx, [next]);
  }, origin);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Validation / cleanup
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Drop every edge whose `from.blockId` or `to.blockId` references a block id
 * that no longer exists in the shared blocks map.  Runs in a single
 * transaction with origin `SABFLOW_SYSTEM_ORIGIN` so listeners can ignore it
 * (it is conceptually a follow-up to a user action that removed a block).
 *
 * Returns the ids of the edges that were dropped (useful for tests).
 */
export function pruneOrphanEdges(doc: YDocLike): string[] {
  const arr = getEdgesArray(doc);
  const blocks = getBlocksMap(doc);
  const orphans: { id: string; index: number }[] = [];
  const len = arr.length;
  for (let i = 0; i < len; i++) {
    const edge = arr.get(i);
    if (!edgeReferencesValidBlocks(edge, blocks)) {
      orphans.push({ id: edge.id, index: i });
    }
  }
  if (orphans.length === 0) return [];

  doc.transact(() => {
    // Delete back-to-front so earlier indices stay valid.
    for (let i = orphans.length - 1; i >= 0; i--) {
      arr.delete(orphans[i].index, 1);
    }
  }, SABFLOW_SYSTEM_ORIGIN);

  return orphans.map((o) => o.id);
}

/**
 * Subscribe to the blocks map and prune orphan edges whenever blocks change.
 * Returns an unsubscribe function.  Intended to be wired once per document
 * (e.g. in the editor bootstrap) so block deletions automatically clean up
 * dangling edges in a follow-up transaction.
 */
export function watchAndPruneOrphanEdges(doc: YDocLike): () => void {
  const blocks = getBlocksMap(doc);
  const handler = (event: YEvent) => {
    // Don't recurse on our own cleanup transactions.
    if (event.transaction.origin === SABFLOW_SYSTEM_ORIGIN) return;
    pruneOrphanEdges(doc);
  };
  blocks.observe(handler);
  return () => blocks.unobserve(handler);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Low-level subscription used by the React hook.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Subscribe to the edges array.  The callback fires after every committed
 * transaction that touches the array, regardless of origin.  Returns an
 * unsubscribe function.
 */
export function subscribeToEdges(doc: YDocLike, onChange: () => void): () => void {
  const arr = getEdgesArray(doc);
  const handler = () => onChange();
  arr.observe(handler);
  return () => arr.unobserve(handler);
}
