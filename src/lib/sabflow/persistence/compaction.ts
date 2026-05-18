/**
 * SabFlow — snapshot-compaction worker.
 *
 * Implements the seq-fence algorithm from docs/adr/sabflow-persistence.md §6.
 *
 * Ownership: this file is the ONLY owner of the compaction routine. Sibling
 * files (the snapshot model, oplog model, RBAC join, R2 cold-tier worker,
 * Yjs runtime adapter) live in their own modules. To avoid coupling on
 * still-evolving sibling APIs we forward-declare the contracts we depend on
 * as `*Adapter` interfaces at the top of the file. The runtime wiring
 * (DI / factory) lands in a later sub-task; consumers pass adapters in.
 *
 * No Yjs import — the `YjsAdapter` interface is the seam.
 *
 * Track A · Phase 2 · sub-task #5 of 10.
 */

// `redis` is exported via CommonJS `module.exports` in src/lib/redis.ts, so we
// require() it instead of `import` to dodge the default-vs-namespace dance.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getRedisClient } = require('@/lib/redis') as {
    getRedisClient: () => Promise<RedisLikeClient>;
};

// -----------------------------------------------------------------------------
// Forward-declared adapter contracts (siblings own the implementations)
// -----------------------------------------------------------------------------

/**
 * Minimal shape of the `redis@4` client we rely on. Declared locally so we are
 * not forced to import the upstream typings (which would bind us to that exact
 * version) and so a test double can be swapped in trivially.
 */
export interface RedisLikeClient {
    set(
        key: string,
        value: string,
        opts: { NX: true; EX: number },
    ): Promise<string | null>;
    del(key: string): Promise<number>;
}

/**
 * Snapshot row contract. Mirrors `sabflow_docs` (ADR §2.1) but only exposes
 * the fields compaction needs. The persistence model module owns the full
 * shape and the actual Mongo collection access.
 */
export interface SnapshotRecord {
    docId: string;
    workspaceId: string;
    version: number;
    /** Last folded oplog `seq` baked into `snapshot`. */
    snapshotSeq: number;
    /** Raw Yjs update bytes (`Y.encodeStateAsUpdate(doc)`). */
    snapshot: Uint8Array | null;
}

export interface SnapshotAdapter {
    /** Returns the current snapshot row, or null if the doc has been deleted. */
    read(workspaceId: string, docId: string): Promise<SnapshotRecord | null>;

    /**
     * Atomically write a new snapshot. MUST be conditional on
     * `expectedVersion`: if the stored `version` no longer equals
     * `expectedVersion`, the implementation MUST return `false` and leave the
     * row untouched (optimistic concurrency, ADR §6 step 6).
     */
    writeIfVersionMatches(input: {
        workspaceId: string;
        docId: string;
        expectedVersion: number;
        nextVersion: number;
        snapshot: Uint8Array;
        snapshotSeq: number;
    }): Promise<boolean>;
}

/** One oplog entry (`sabflow_oplog`, ADR §2.2). */
export interface OplogEntry {
    _id: string;
    docId: string;
    seq: number;
    update: Uint8Array;
}

export interface OplogAdapter {
    /**
     * Return entries with `seq > afterSeq AND seq <= fenceSeq`, ordered by
     * `seq` ASC. Implementations should cap the read window for safety; the
     * worker tolerates partial folds (any tail not returned is picked up on
     * the next pass).
     */
    readRange(input: {
        workspaceId: string;
        docId: string;
        afterSeq: number;
        fenceSeq: number;
    }): Promise<OplogEntry[]>;

    /** Highest currently-allocated `seq` for the doc (the seq fence). */
    highestSeq(input: { workspaceId: string; docId: string }): Promise<number>;

    /**
     * Mark the supplied entries as compacted so the TTL index reaps them.
     * Sets `compacted:true` and (per the model module's policy) rewinds `ts`
     * to a tombstone past-time. Idempotent.
     */
    tombstone(input: {
        workspaceId: string;
        docId: string;
        ids: string[];
    }): Promise<void>;
}

/**
 * Yjs runtime seam. The CRDT lib is not a dep of this package yet — see
 * `docs/adr/sabflow-crdt-lib.md`. The shape mirrors the two Yjs functions
 * we need (`applyUpdate`, `encodeStateAsUpdate`) plus a doc factory.
 */
export interface YjsAdapter {
    /** Allocate a fresh Y.Doc with `gc:true` (ADR §6 risk #2). */
    createDoc(): YDocHandle;
    /** `Y.applyUpdate(doc, update)`. */
    applyUpdate(doc: YDocHandle, update: Uint8Array): void;
    /** `Y.encodeStateAsUpdate(doc)`. */
    encodeStateAsUpdate(doc: YDocHandle): Uint8Array;
}

/** Opaque handle to a Y.Doc — siblings own the concrete type. */
export type YDocHandle = { readonly __brand: 'YDocHandle' } | object;

/** Minimal structured logger surface (Pino-compatible). */
export interface Logger {
    info(obj: Record<string, unknown>, msg?: string): void;
    warn(obj: Record<string, unknown>, msg?: string): void;
    error(obj: Record<string, unknown>, msg?: string): void;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export interface CompactionInput {
    workspaceId: string;
    docId: string;
}

export interface CompactionDeps {
    snapshots: SnapshotAdapter;
    oplog: OplogAdapter;
    yjs: YjsAdapter;
    redis?: RedisLikeClient;
    logger?: Logger;
}

/**
 * Outcome of a single compaction pass. Returned regardless of whether the
 * pass folded anything — callers inspect `foldedEntries === 0` and `skipped`
 * to decide whether to reschedule.
 */
export interface CompactionResult {
    docId: string;
    foldedEntries: number;
    newVersion: number;
    durationMs: number;
    /**
     * Set when no fold happened. Values:
     * - `locked` — another worker holds the lock; try again later.
     * - `missing` — snapshot row not found (deleted / never created).
     * - `empty` — no oplog entries past the fence; nothing to fold.
     * - `version-race` — concurrent snapshot bump; retry on next tick.
     */
    skipped?: 'locked' | 'missing' | 'empty' | 'version-race';
}

const LOCK_PREFIX = 'sabflow:compact:';
const LOCK_TTL_SECONDS = 300;
const LOCK_VALUE = '1';

const fallbackLogger: Logger = {
    // eslint-disable-next-line no-console
    info: (obj, msg) => console.info('[sabflow.compaction]', msg ?? '', obj),
    // eslint-disable-next-line no-console
    warn: (obj, msg) => console.warn('[sabflow.compaction]', msg ?? '', obj),
    // eslint-disable-next-line no-console
    error: (obj, msg) => console.error('[sabflow.compaction]', msg ?? '', obj),
};

/**
 * Compact a single doc's oplog into its snapshot per ADR §6.
 *
 * Algorithm (seq-fence):
 *   1. Acquire `sabflow:compact:<docId>` via `SET NX EX 300`.
 *   2. Read current snapshot + the doc's highest `seq` (the fence).
 *   3. Read oplog with `snapshotSeq < seq <= fence`.
 *   4. Hydrate Y.Doc from snapshot, apply each update.
 *   5. Encode the new state; write conditional on `version === expected`.
 *   6. Tombstone the folded entries; TTL reaps them.
 *   7. Release the lock (best-effort; TTL backstops a crash).
 *
 * Late ops (`seq > fence`) are intentionally deferred to the next pass.
 */
export async function compactDoc(
    input: CompactionInput,
    deps: CompactionDeps,
): Promise<CompactionResult> {
    const { workspaceId, docId } = input;
    const logger = deps.logger ?? fallbackLogger;
    const startedAt = Date.now();
    const lockKey = `${LOCK_PREFIX}${docId}`;

    const redis = deps.redis ?? (await getRedisClient());

    // (1) Lock
    const locked = await redis.set(lockKey, LOCK_VALUE, {
        NX: true,
        EX: LOCK_TTL_SECONDS,
    });
    if (locked !== 'OK') {
        logger.info(
            { workspaceId, docId, lockKey },
            'compaction skipped: lock held',
        );
        return {
            docId,
            foldedEntries: 0,
            newVersion: 0,
            durationMs: Date.now() - startedAt,
            skipped: 'locked',
        };
    }

    try {
        // (2) Read current snapshot + seq fence
        const snap = await deps.snapshots.read(workspaceId, docId);
        if (!snap) {
            logger.warn(
                { workspaceId, docId },
                'compaction skipped: snapshot missing',
            );
            return {
                docId,
                foldedEntries: 0,
                newVersion: 0,
                durationMs: Date.now() - startedAt,
                skipped: 'missing',
            };
        }

        const fenceSeq = await deps.oplog.highestSeq({ workspaceId, docId });
        if (fenceSeq <= snap.snapshotSeq) {
            logger.info(
                {
                    workspaceId,
                    docId,
                    version: snap.version,
                    snapshotSeq: snap.snapshotSeq,
                    fenceSeq,
                },
                'compaction skipped: no new oplog entries',
            );
            return {
                docId,
                foldedEntries: 0,
                newVersion: snap.version,
                durationMs: Date.now() - startedAt,
                skipped: 'empty',
            };
        }

        // (3) Read oplog window (afterSeq, fenceSeq]
        const entries = await deps.oplog.readRange({
            workspaceId,
            docId,
            afterSeq: snap.snapshotSeq,
            fenceSeq,
        });

        if (entries.length === 0) {
            // Fence advanced past snapshotSeq but the range came back empty —
            // e.g. all entries already tombstoned by a partial prior pass.
            logger.info(
                { workspaceId, docId, fenceSeq, snapshotSeq: snap.snapshotSeq },
                'compaction skipped: empty oplog window',
            );
            return {
                docId,
                foldedEntries: 0,
                newVersion: snap.version,
                durationMs: Date.now() - startedAt,
                skipped: 'empty',
            };
        }

        // (4) Apply via Yjs adapter
        const doc = deps.yjs.createDoc();
        if (snap.snapshot && snap.snapshot.byteLength > 0) {
            deps.yjs.applyUpdate(doc, snap.snapshot);
        }
        let lastFoldedSeq = snap.snapshotSeq;
        for (const entry of entries) {
            deps.yjs.applyUpdate(doc, entry.update);
            lastFoldedSeq = entry.seq;
        }
        const nextSnapshot = deps.yjs.encodeStateAsUpdate(doc);

        // (5) Conditional write — bail if `version` advanced under us.
        const nextVersion = snap.version + 1;
        const wrote = await deps.snapshots.writeIfVersionMatches({
            workspaceId,
            docId,
            expectedVersion: snap.version,
            nextVersion,
            snapshot: nextSnapshot,
            snapshotSeq: lastFoldedSeq,
        });

        if (!wrote) {
            logger.warn(
                {
                    workspaceId,
                    docId,
                    expectedVersion: snap.version,
                    foldedEntries: entries.length,
                },
                'compaction aborted: version race, discarding fold',
            );
            return {
                docId,
                foldedEntries: 0,
                newVersion: snap.version,
                durationMs: Date.now() - startedAt,
                skipped: 'version-race',
            };
        }

        // (6) Tombstone folded entries; TTL index reaps them per the
        //     model module's retention policy (ADR §3.2).
        await deps.oplog.tombstone({
            workspaceId,
            docId,
            ids: entries.map((e) => e._id),
        });

        const durationMs = Date.now() - startedAt;
        logger.info(
            {
                workspaceId,
                docId,
                foldedEntries: entries.length,
                fromVersion: snap.version,
                newVersion: nextVersion,
                snapshotSeq: lastFoldedSeq,
                snapshotBytes: nextSnapshot.byteLength,
                durationMs,
            },
            'compaction succeeded',
        );

        return {
            docId,
            foldedEntries: entries.length,
            newVersion: nextVersion,
            durationMs,
        };
    } catch (err) {
        logger.error(
            {
                workspaceId,
                docId,
                err: err instanceof Error ? err.message : String(err),
            },
            'compaction failed',
        );
        throw err;
    } finally {
        // (7) Best-effort lock release. TTL is the backstop on crash.
        try {
            await redis.del(lockKey);
        } catch (releaseErr) {
            logger.warn(
                {
                    workspaceId,
                    docId,
                    lockKey,
                    err:
                        releaseErr instanceof Error
                            ? releaseErr.message
                            : String(releaseErr),
                },
                'compaction lock release failed (TTL will reap)',
            );
        }
    }
}
