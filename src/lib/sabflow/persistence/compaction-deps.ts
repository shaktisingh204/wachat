/**
 * Production `CompactionDeps` adapters for `compactDoc`.
 *
 * Binds the compaction worker's seams to the real stores:
 *
 *   - SnapshotAdapter → `sabflow_docs` (snapshot.ts). The interface's
 *     `snapshotSeq` ("last folded oplog seq baked into the snapshot") is
 *     persisted as an extension field on the row — same pattern as the GC
 *     route's `oplogPending` / `lastCompactedAt` eligibility fields —
 *     defaulting to 0 for docs that have never been compacted.
 *   - OplogAdapter → `sabflow_oplog` + the `sabflow_doc_seq` counter
 *     (oplog.ts). Tombstoning sets `compacted: true` and rewinds `ts` to
 *     epoch so the TTL index reaps the folded entries (indexes.ts policy).
 *   - YjsAdapter → the real `yjs` package (`Y.Doc({ gc: true })`).
 *
 * Server-only by transitivity (`@/lib/mongodb`) — only the GC cron route
 * and other Next.js server code may import this module; never the tsx
 * workers.
 */

import * as Y from 'yjs';
import { ObjectId, type Binary } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabFlowDocCollection } from './snapshot';
import {
    SabFlowOpLogModel,
    SABFLOW_DOC_SEQ_COLLECTION,
} from './oplog';
import type {
    CompactionDeps,
    OplogEntry,
    SnapshotAdapter,
    OplogAdapter,
    YjsAdapter,
    YDocHandle,
} from './compaction';

/** Window cap per fold pass — any tail is picked up on the next tick. */
const READ_RANGE_CAP = 10_000;

function asObjectId(id: string | ObjectId): ObjectId {
    return typeof id === 'string' ? new ObjectId(id) : id;
}

/** Normalise BSON Binary / Buffer / Uint8Array to a plain Uint8Array. */
function toUint8(value: Binary | Buffer | Uint8Array | null | undefined): Uint8Array | null {
    if (value == null) return null;
    if (value instanceof Uint8Array) return value;
    const buf = (value as Binary).buffer;
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

const snapshots: SnapshotAdapter = {
    async read(workspaceId, docId) {
        const col = await getSabFlowDocCollection();
        const row = await col.findOne({
            _id: asObjectId(docId),
            workspaceId: asObjectId(workspaceId),
        });
        if (!row || row.deletedAt) return null;
        return {
            docId,
            workspaceId,
            version: row.version,
            snapshotSeq:
                (row as unknown as { snapshotSeq?: number }).snapshotSeq ?? 0,
            snapshot: toUint8(row.snapshot),
        };
    },

    async writeIfVersionMatches(input) {
        const col = await getSabFlowDocCollection();
        const snapshotBuf = Buffer.from(input.snapshot);
        const res = await col.updateOne(
            {
                _id: asObjectId(input.docId),
                workspaceId: asObjectId(input.workspaceId),
                version: input.expectedVersion,
            },
            {
                $set: {
                    version: input.nextVersion,
                    snapshot: snapshotBuf,
                    snapshotSize: snapshotBuf.byteLength,
                    snapshotSeq: input.snapshotSeq,
                    lastCompactedAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );
        return res.matchedCount === 1;
    },
};

const oplog: OplogAdapter = {
    async readRange({ docId, afterSeq, fenceSeq }) {
        const col = await SabFlowOpLogModel();
        const rows = await col
            .find({
                docId: asObjectId(docId),
                seq: { $gt: afterSeq, $lte: fenceSeq },
            })
            .sort({ seq: 1 })
            .limit(READ_RANGE_CAP)
            .toArray();
        return rows
            .map((row): OplogEntry | null => {
                const update = toUint8(row.update);
                if (!update) return null;
                return {
                    _id: row._id.toHexString(),
                    docId,
                    seq: row.seq,
                    update,
                };
            })
            .filter((e): e is OplogEntry => e !== null);
    },

    async highestSeq({ docId }) {
        const { db } = await connectToDatabase();
        const counter = await db
            .collection<{ _id: ObjectId; seq?: number }>(SABFLOW_DOC_SEQ_COLLECTION)
            .findOne({ _id: asObjectId(docId) });
        return typeof counter?.seq === 'number' ? counter.seq : 0;
    },

    async tombstone({ ids }) {
        if (ids.length === 0) return;
        const col = await SabFlowOpLogModel();
        await col.updateMany(
            { _id: { $in: ids.map((id) => new ObjectId(id)) } },
            // `compacted` flags the fold; rewinding `ts` to epoch hands the
            // entries to the TTL index for reaping (indexes.ts policy).
            { $set: { compacted: true, ts: new Date(0) } } as never,
        );
    },
};

const yjs: YjsAdapter = {
    createDoc(): YDocHandle {
        return new Y.Doc({ gc: true });
    },
    applyUpdate(doc, update) {
        Y.applyUpdate(doc as Y.Doc, update);
    },
    encodeStateAsUpdate(doc) {
        return Y.encodeStateAsUpdate(doc as Y.Doc);
    },
};

/** Production dependency bundle for `compactDoc`. */
export function makeCompactionDeps(): CompactionDeps {
    return { snapshots, oplog, yjs };
}
