/**
 * SabFlow editor — CRDT block-list adapter.
 *
 * Track A · Phase 6 · sub-task #1 of 10.
 *
 * Per ADR `docs/adr/sabflow-state-management.md` we are migrating the editor's
 * source of truth from a local React `useState` snapshot to a Yjs document
 * synced over WebSocket. This module is the **node/block-list adapter** —
 * the narrowest possible surface for reading and mutating the flow's
 * `Block[]` projection that today lives in `EditorPage.tsx` (line 48,
 * `const [flow, setFlow] = useState(initialFlow)`).
 *
 * Doc shape (per ADR `docs/adr/sabflow-doc-schema.md` keep-events+groups+blocks
 * directive, and the sibling `undo-redo.ts` scope):
 *
 *     doc.getArray('blocks')   // Y.Array<Block>
 *     doc.getArray('edges')    // sibling adapter
 *     doc.getMap('viewport')   // sibling adapter
 *
 * For Phase 6 #1 we store each entry as a plain JSON `Block` value inside
 * the Y.Array — that is the n8n-aligned shape committed to by the doc-schema
 * ADR. Per-field merge of in-block patches (promoting entries to `Y.Map`)
 * is a separate decision tracked by Phase 6 #2/#3, not this sub-task.
 *
 * Why a separate adapter file
 * ---------------------------
 * Phase 6 #6 will swap call sites in `EditorPage.tsx`. Until then the editor
 * still renders from React state — this adapter just gives the rest of the
 * Phase-6 work a stable boundary to wire against. Mutations all flow through
 * `doc.transact(..., origin ?? SABFLOW_LOCAL_ORIGIN)` so the `UndoManager` in
 * `src/lib/sabflow/client/undo-redo.ts` picks them up.
 *
 * Yjs is forward-declared (zero static import) so the module loads even in
 * workspaces where `yjs` is not yet installed. Concrete `Y.Doc` instances
 * (returned by `useSabFlowDoc`) satisfy the `YDocLike` contract structurally.
 */
'use client';

import { SABFLOW_LOCAL_ORIGIN } from '@/lib/sabflow/client/undo-redo';
import type { Block } from '@/lib/sabflow/types';

// ---------------------------------------------------------------------------
// Forward-declared Yjs surface
// ---------------------------------------------------------------------------

/**
 * Minimal structural slice of `Y.Array` we touch. The list semantics we
 * depend on: indexed `get`, `length`, snapshot `toArray`, integrity-preserving
 * `insert`/`delete` (the only mutation primitives Yjs offers — there is no
 * `splice` on `Y.Array`), and `observeDeep` so the hook re-renders when ANY
 * descendant changes (block added, block reordered, block field patched).
 *
 * The element type defaults to `unknown` — concrete adapters narrow it
 * (here `Block`). Real Yjs accepts any JSON-serialisable value as well as
 * nested `Y.AbstractType`s; we only use the JSON path in this adapter.
 */
export interface YArrayLike<T = unknown> {
  get(index: number): T;
  insert(index: number, content: T[]): void;
  delete(index: number, length?: number): void;
  toArray(): T[];
  /** Subscribes to nested changes; returns void in real Yjs — we ignore. */
  observeDeep(handler: (events: unknown[]) => void): void;
  unobserveDeep(handler: (events: unknown[]) => void): void;
  readonly length: number;
}

/**
 * Structural slice of `Y.Doc`. We only need the array getter (for the blocks
 * list) and `transact` so every mutation we ship is tagged with our origin —
 * that's what the UndoManager keys off (see `undo-redo.ts` lines 192-199).
 *
 * `transact` takes a callback and an opaque `origin`. Real Yjs passes a
 * `Y.Transaction` to the callback; we forward-declare it as `unknown` because
 * none of the adapters in this module need to look inside it.
 */
export interface YDocLike {
  getArray<T = unknown>(name: string): YArrayLike<T>;
  transact(fn: (tr: unknown) => void, origin?: unknown): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Y.Array key used for the block list. Mirrors the shape spec'd in
 * `docs/adr/sabflow-state-management.md` §4 step 6 and the scope set the
 * UndoManager in `undo-redo.ts` is bound to.
 */
export const BLOCKS_ARRAY_KEY = 'blocks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Locate the Block entry by id, returning its index. Linear scan — block
 * lists in SabFlow today are bounded (≤ a few hundred per flow) and a
 * secondary id→index map would have to be kept in sync with every
 * `observeDeep` event for marginal benefit at typical sizes.
 *
 * Returns `-1` if no entry matches (mirrors `Array.prototype.indexOf`).
 */
function indexOfBlock(arr: YArrayLike<Block>, blockId: string): number {
  const len = arr.length;
  for (let i = 0; i < len; i++) {
    // `arr.get(i)` returns the materialised JSON object — Yjs deep-clones
    // it on read for plain-JSON Y.Array entries, so the returned value is
    // safe to inspect without snapshotting.
    if (arr.get(i)?.id === blockId) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Public adapter — pure functions over a Y.Doc
// ---------------------------------------------------------------------------

/**
 * Read the current block list from a SabFlow CRDT doc.
 *
 * O(n) over `blocks.length`. The hook calls this on every `observeDeep`
 * notification to produce a new immutable snapshot React can compare by
 * reference. We deliberately do NOT memoise across calls because any deep
 * change to any entry invalidates the previous snapshot anyway — `toArray`
 * returns fresh JSON-cloned values, which is what we want for React's
 * `Object.is` bailouts on unchanged neighbours to be meaningful.
 */
export function getNodes(doc: YDocLike): Block[] {
  return doc.getArray<Block>(BLOCKS_ARRAY_KEY).toArray();
}

/**
 * Append a block to the doc's `blocks` array.
 *
 * The mutation runs inside a single `doc.transact` so the UndoManager records
 * exactly one stack item per call (matches the "one user gesture = one undo"
 * promise from ADR §3.2). Origin defaults to {@link SABFLOW_LOCAL_ORIGIN} so
 * the entry is captured on the local-undo path; pass a different origin for
 * server-applied or recipe-installer writes that should NOT be undoable.
 */
export function addNode(doc: YDocLike, block: Block, origin?: unknown): void {
  doc.transact(() => {
    const arr = doc.getArray<Block>(BLOCKS_ARRAY_KEY);
    arr.insert(arr.length, [block]);
  }, origin ?? SABFLOW_LOCAL_ORIGIN);
}

/**
 * Patch an existing block's fields in-place.
 *
 * Because we store each entry as a plain JSON object (not a Y.Map), Yjs
 * cannot diff at field granularity for us — we read, merge, replace. Two
 * users simultaneously patching the same block will produce a
 * last-writer-wins outcome on that block (the CRDT still merges *across*
 * blocks fine — adds, deletes, and reorders are non-clobbering). Phase 6
 * #2/#3 will revisit promoting Block to `Y.Map` if intra-block contention
 * becomes a real problem; until then plain JSON keeps the on-wire and
 * on-disk shape identical to the n8n-aligned doc-schema.
 *
 * Unknown `blockId` is a no-op (no throw): the editor often races a delete
 * against an in-flight property edit, and that should silently lose.
 *
 * Returns `true` if a block was found and updated, `false` otherwise.
 */
export function updateNode(
  doc: YDocLike,
  blockId: string,
  patch: Partial<Block>,
  origin?: unknown,
): boolean {
  let updated = false;
  doc.transact(() => {
    const arr = doc.getArray<Block>(BLOCKS_ARRAY_KEY);
    const idx = indexOfBlock(arr, blockId);
    if (idx < 0) return;
    const current = arr.get(idx);
    // Field-level patch with `undefined`-deletes: callers can clear optional
    // fields (`Block.pinData`, `Block.notes`, etc.) by passing `undefined`.
    const next: Block = { ...current, ...patch };
    for (const key of Object.keys(patch) as Array<keyof Block>) {
      if (patch[key] === undefined) {
        delete (next as Record<string, unknown>)[key as string];
      }
    }
    // Yjs has no in-place replace for Y.Array entries — delete-then-insert
    // is the documented swap idiom. Same transaction → single undo entry.
    arr.delete(idx, 1);
    arr.insert(idx, [next]);
    updated = true;
  }, origin ?? SABFLOW_LOCAL_ORIGIN);
  return updated;
}

/**
 * Remove a block from the `blocks` array by id.
 *
 * Idempotent: removing a missing id is a no-op (mirrors `updateNode`).
 * Edges that reference the block are NOT cleaned up here — that's the
 * responsibility of the edge-list adapter (Phase 6 sub-task #2). Keeping
 * this surface focused on a single Y.Array matches the file-ownership
 * contract from the Phase 6 plan.
 */
export function removeNode(
  doc: YDocLike,
  blockId: string,
  origin?: unknown,
): boolean {
  let removed = false;
  doc.transact(() => {
    const arr = doc.getArray<Block>(BLOCKS_ARRAY_KEY);
    const idx = indexOfBlock(arr, blockId);
    if (idx < 0) return;
    arr.delete(idx, 1);
    removed = true;
  }, origin ?? SABFLOW_LOCAL_ORIGIN);
  return removed;
}
