/**
 * SabFlow — CRDT group + per-block lock operations.
 *
 * Track A · Phase 6 · sub-task #4 of 10.
 *
 * Owns: every group/ungroup/add-to-group/remove-from-group and per-block
 * lock/unlock op against the SabFlow CRDT doc. Each helper is a pure
 * transaction-wrapped mutation against the standard SabFlow doc shape:
 *
 *     doc.getArray('groups')    // Y.Array<Y.Map>   (this file's primary scope)
 *     doc.getArray('blocks')    // Y.Array<Y.Map>   (sibling — block records)
 *
 * Per ADR `docs/adr/sabflow-state-management.md` §4 step 6, `flow.groups`
 * is a `Y.Array` of `Y.Map`s and blocks live inside each group's nested
 * `blocks` `Y.Array` referencing block ids. The actual block records (with
 * `type`, `options`, `items`, …) live in their own root-level `blocks`
 * Y.Array — owned by a sibling sub-task — so locks (which live on the block
 * record) are independent of group membership.
 *
 * Ownership: this file is the ONLY owner of group-shape + block-lock CRDT
 * ops. Sibling Phase 6 modules (selection, drag, edge ops, viewport sync,
 * inspector wiring) live in their own files in this directory.
 *
 * No `yjs` import. The `YDocLike` / `YArrayLike` / `YMapLike` interfaces
 * below forward-declare the shape we depend on, matching the pattern in
 * `src/lib/sabflow/client/undo-redo.ts`. Sibling Phase 1 sub-task 5 picks
 * the concrete library; wiring lands in the doc-runtime sibling.
 *
 * Originating transactions are tagged with {@link SABFLOW_LOCAL_ORIGIN} so
 * the Phase 5 undo manager (`src/lib/sabflow/client/undo-redo.ts`) treats
 * them as undoable local edits — and so remote applies tagged `'from
 * server'` upstream do NOT re-trigger any side-effects here.
 */

// -----------------------------------------------------------------------------
// Forward-declared Yjs contracts
// -----------------------------------------------------------------------------

/** Brand to keep structural types from collapsing to `unknown`. */
export interface YAbstractTypeLike {
    readonly _yAbstractType?: never;
}

/**
 * Minimal `Y.Map<unknown>` surface this file needs. Real `Y.Map` has more
 * (observe, toJSON, clone, doc, parent, …) — we only forward what the
 * group/lock ops use. The block-shape sibling owns the full block-map
 * factory; we treat it as opaque here.
 */
export interface YMapLike<V = unknown> extends YAbstractTypeLike {
    get(key: string): V | undefined;
    set(key: string, value: V): YMapLike<V>;
    delete(key: string): void;
    has(key: string): boolean;
}

/**
 * Minimal `Y.Array<T>` surface this file needs. We use it for both the
 * top-level `groups` array and each group's child `blocks` id-list.
 */
export interface YArrayLike<T = unknown> extends YAbstractTypeLike {
    readonly length: number;
    get(index: number): T;
    push(items: T[]): void;
    insert(index: number, items: T[]): void;
    delete(index: number, length?: number): void;
    toArray(): T[];
}

/**
 * Constructor for a fresh, detached `Y.Map`. The doc-runtime sibling
 * supplies this so the helpers stay pure-TS / `yjs`-free. Equivalent of
 * `() => new Y.Map()` upstream.
 */
export type YMapFactory = <V = unknown>() => YMapLike<V>;

/**
 * Constructor for a fresh, detached `Y.Array`. Equivalent of
 * `() => new Y.Array()` upstream.
 */
export type YArrayFactory = <T = unknown>() => YArrayLike<T>;

/**
 * Minimal `Y.Doc` surface for this module: the two getters we touch plus
 * `transact`, which we MUST use to batch every mutation into a single
 * atomic CRDT update with our local-origin tag.
 */
export interface YDocLike {
    getArray<T = unknown>(name: string): YArrayLike<T>;
    getMap<V = unknown>(name: string): YMapLike<V>;
    transact<R>(fn: () => R, origin?: unknown): R;
}

/**
 * DI seam — consumers pass the factories alongside the doc. The
 * doc-runtime sibling exports these from the chosen CRDT lib so tests
 * can supply a fake.
 */
export interface CrdtGroupRuntime {
    doc: YDocLike;
    createMap: YMapFactory;
    createArray: YArrayFactory;
    /** Origin tag for every transaction this file opens. */
    origin?: unknown;
}

// -----------------------------------------------------------------------------
// Public configuration / constants
// -----------------------------------------------------------------------------

/**
 * Re-exported sentinel that matches the one in
 * `src/lib/sabflow/client/undo-redo.ts`. We don't `import` from that file
 * because the editor-state layer must not depend on the client SDK layer
 * (one-way arrow: SDK → editor, not the other way). Using `Symbol.for`
 * with the same key gives us pointer-equality across modules at runtime.
 */
export const SABFLOW_LOCAL_ORIGIN: unique symbol = Symbol.for(
    'sabflow.local.origin',
);

/**
 * Auto-expiry window for a block lock. After this many ms a lock is
 * stale — consumers (editor + WS gateway) treat a stale lock as absent
 * via {@link isLocked}, so blocked sessions self-heal if the locker
 * disconnects without explicit unlock.
 *
 * 5 min mirrors the n8n editor-lock heartbeat and matches the Phase 7
 * awareness TTL chosen by the presence sub-task.
 */
export const SABFLOW_LOCK_TTL_MS = 5 * 60 * 1000;

/** Role granted unconditional unlock authority. See {@link unlockBlock}. */
export const SABFLOW_ADMIN_ROLE = 'admin' as const;

/** Key names inside the group `Y.Map`. */
const GROUP_KEY = {
    id: 'id',
    title: 'title',
    /** `Y.Array<string>` of block ids referenced by this group. */
    blockIds: 'blockIds',
    createdAt: 'createdAt',
} as const;

/** Key names inside a block `Y.Map`. We only touch `id` and `locked`. */
const BLOCK_KEY = {
    id: 'id',
    /** `{ by: string; at: number }` when held, absent / null when free. */
    locked: 'locked',
} as const;

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

/**
 * Lock metadata stored on a block's `Y.Map` under `locked`. `at` is a
 * Unix epoch in ms (UTC) — consumers compute expiry as `at + TTL`.
 */
export interface BlockLock {
    by: string;
    at: number;
}

/**
 * Caller identity passed to {@link unlockBlock}. Either the user holds
 * the lock (matched by `userId`) or carries the {@link SABFLOW_ADMIN_ROLE}
 * role — anything else and the call throws.
 */
export interface UnlockRequester {
    userId: string;
    role?: string;
}

/** Thrown by {@link unlockBlock} when the requester is not authorised. */
export class BlockLockAuthError extends Error {
    constructor(blockId: string, requesterId: string, holderId: string | null) {
        super(
            holderId
                ? `[sabflow.locks] user "${requesterId}" cannot unlock block "${blockId}" held by "${holderId}"`
                : `[sabflow.locks] block "${blockId}" is not locked (requester "${requesterId}")`,
        );
        this.name = 'BlockLockAuthError';
    }
}

// -----------------------------------------------------------------------------
// Group ops
// -----------------------------------------------------------------------------

/**
 * Create a new group entry in `doc.getArray('groups')` referencing the
 * supplied `blockIds`. Wraps the create + push in a single transaction
 * tagged with the local-origin sentinel so undo treats it as one step.
 *
 * @returns the synthesised `groupId`.
 */
export function groupBlocks(
    runtime: CrdtGroupRuntime,
    blockIds: string[],
    label?: string,
): string {
    const { doc, createMap, createArray, origin = SABFLOW_LOCAL_ORIGIN } =
        runtime;
    const groups = doc.getArray<YMapLike>('groups');
    const groupId = nextGroupId();

    doc.transact(() => {
        const group = createMap();
        const idList = createArray<string>();
        // De-dup defensively — a caller passing the same id twice would
        // otherwise inflate the membership count silently.
        const seen = new Set<string>();
        const cleanIds = blockIds.filter((id) => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        idList.push(cleanIds);

        group.set(GROUP_KEY.id, groupId);
        group.set(GROUP_KEY.title, label ?? defaultGroupTitle(groups.length));
        group.set(GROUP_KEY.blockIds, idList);
        group.set(GROUP_KEY.createdAt, Date.now());
        groups.push([group]);
    }, origin);

    return groupId;
}

/**
 * Delete the group entry with the given `groupId`. Member blocks are NOT
 * deleted — they become ungrouped (sibling block-shape sub-task is the
 * single owner of block lifecycle, so we never destroy blocks here).
 *
 * No-ops silently if the group is already absent — concurrent
 * `ungroupBlocks` calls on two clients then converge cleanly.
 */
export function ungroupBlocks(
    runtime: CrdtGroupRuntime,
    groupId: string,
): void {
    const { doc, origin = SABFLOW_LOCAL_ORIGIN } = runtime;
    const groups = doc.getArray<YMapLike>('groups');

    doc.transact(() => {
        const index = findGroupIndex(groups, groupId);
        if (index < 0) return;
        groups.delete(index, 1);
    }, origin);
}

/**
 * Append `blockId` to the named group's member id-list. Idempotent — if
 * the block is already a member the call is a no-op (so two clients adding
 * the same block converge to one entry, not two).
 */
export function addToGroup(
    runtime: CrdtGroupRuntime,
    groupId: string,
    blockId: string,
): void {
    const { doc, origin = SABFLOW_LOCAL_ORIGIN } = runtime;
    const groups = doc.getArray<YMapLike>('groups');

    doc.transact(() => {
        const group = findGroup(groups, groupId);
        if (!group) return;
        const idList = group.get(GROUP_KEY.blockIds) as
            | YArrayLike<string>
            | undefined;
        if (!idList) return;
        if (idList.toArray().includes(blockId)) return;
        idList.push([blockId]);
    }, origin);
}

/**
 * Remove `blockId` from the named group's member id-list. No-op if the
 * group or membership is already gone — keeps concurrent removers
 * convergent.
 */
export function removeFromGroup(
    runtime: CrdtGroupRuntime,
    groupId: string,
    blockId: string,
): void {
    const { doc, origin = SABFLOW_LOCAL_ORIGIN } = runtime;
    const groups = doc.getArray<YMapLike>('groups');

    doc.transact(() => {
        const group = findGroup(groups, groupId);
        if (!group) return;
        const idList = group.get(GROUP_KEY.blockIds) as
            | YArrayLike<string>
            | undefined;
        if (!idList) return;
        const arr = idList.toArray();
        const idx = arr.indexOf(blockId);
        if (idx < 0) return;
        idList.delete(idx, 1);
    }, origin);
}

// -----------------------------------------------------------------------------
// Block lock ops
// -----------------------------------------------------------------------------

/**
 * Mark a block as held by `lockedBy`. Overwrites any existing `locked`
 * entry — collab callers are expected to gate writes via {@link isLocked}
 * first; this raw op is also used by the WS gateway when promoting an
 * awareness selection to a hard lock and must always succeed.
 *
 * The block record itself is owned by the sibling block-shape sub-task —
 * we look it up by id rather than create one. If the block does not
 * exist this is a no-op (consumers should not lock phantom ids; the
 * silent skip just prevents a crash if the block was concurrently
 * deleted).
 */
export function lockBlock(
    runtime: CrdtGroupRuntime,
    blockId: string,
    lockedBy: string,
): void {
    const { doc, origin = SABFLOW_LOCAL_ORIGIN } = runtime;
    const blocks = doc.getArray<YMapLike>('blocks');

    doc.transact(() => {
        const block = findBlock(blocks, blockId);
        if (!block) return;
        const lock: BlockLock = { by: lockedBy, at: Date.now() };
        block.set(BLOCK_KEY.locked, lock as unknown);
    }, origin);
}

/**
 * Release a block lock. Only the original locker — or a caller carrying
 * the {@link SABFLOW_ADMIN_ROLE} role — may unlock; anyone else trips
 * {@link BlockLockAuthError}.
 *
 * Stale locks (older than {@link SABFLOW_LOCK_TTL_MS}) are treated as
 * unheld, so any requester can clear them without auth — that's how
 * disconnected sessions self-heal.
 */
export function unlockBlock(
    runtime: CrdtGroupRuntime,
    blockId: string,
    requester: UnlockRequester,
): void {
    const { doc, origin = SABFLOW_LOCAL_ORIGIN } = runtime;
    const blocks = doc.getArray<YMapLike>('blocks');
    const current = isLocked(runtime, blockId);
    const isAdmin = requester.role === SABFLOW_ADMIN_ROLE;

    if (current && current.by !== requester.userId && !isAdmin) {
        throw new BlockLockAuthError(blockId, requester.userId, current.by);
    }

    doc.transact(() => {
        const block = findBlock(blocks, blockId);
        if (!block) return;
        block.delete(BLOCK_KEY.locked);
    }, origin);
}

/**
 * Return the live lock entry for `blockId`, or `null` if free or stale.
 *
 * Stale-lock policy: a lock whose `at` is more than {@link
 * SABFLOW_LOCK_TTL_MS} in the past is reported as `null` so consumers
 * treat it as absent. We do NOT mutate the doc here — auto-expiry is a
 * pure read-side concern. The next `lockBlock`/`unlockBlock` will rewrite
 * the field, garbage-collecting the stale record naturally.
 *
 * `now` is injectable for tests; defaults to `Date.now()`.
 */
export function isLocked(
    runtime: CrdtGroupRuntime,
    blockId: string,
    now: number = Date.now(),
): BlockLock | null {
    const blocks = runtime.doc.getArray<YMapLike>('blocks');
    const block = findBlock(blocks, blockId);
    if (!block) return null;
    const raw = block.get(BLOCK_KEY.locked) as BlockLock | undefined | null;
    if (!raw || typeof raw.by !== 'string' || typeof raw.at !== 'number') {
        return null;
    }
    if (now - raw.at > SABFLOW_LOCK_TTL_MS) return null;
    return { by: raw.by, at: raw.at };
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

/** Linear scan — groups are a flat list and never large enough for an index. */
function findGroupIndex(
    groups: YArrayLike<YMapLike>,
    groupId: string,
): number {
    for (let i = 0; i < groups.length; i++) {
        const entry = groups.get(i);
        if (entry && entry.get(GROUP_KEY.id) === groupId) return i;
    }
    return -1;
}

function findGroup(
    groups: YArrayLike<YMapLike>,
    groupId: string,
): YMapLike | null {
    const i = findGroupIndex(groups, groupId);
    return i < 0 ? null : groups.get(i);
}

function findBlock(
    blocks: YArrayLike<YMapLike>,
    blockId: string,
): YMapLike | null {
    for (let i = 0; i < blocks.length; i++) {
        const entry = blocks.get(i);
        if (entry && entry.get(BLOCK_KEY.id) === blockId) return entry;
    }
    return null;
}

/**
 * Monotonic-ish id with a random suffix. Collisions across replicas are
 * negligible at 64 bits of entropy and the CRDT-level dedupe (groups
 * array push order) absorbs the rare clash. We avoid pulling `crypto`
 * here so the file stays Edge-runtime safe.
 */
function nextGroupId(): string {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 10);
    return `grp_${t}_${r}`;
}

function defaultGroupTitle(existingCount: number): string {
    return `Group ${existingCount + 1}`;
}
