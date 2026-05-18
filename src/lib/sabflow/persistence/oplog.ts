/**
 * SabFlow — `sabflow_oplog` collection (append-only CRDT updates).
 *
 * Track / Phase / Sub-task: Track A · Phase 2 · #2
 * ADR: `docs/adr/sabflow-persistence.md` §2.2
 *
 * Scope of this file (per the phase-2 sub-task split):
 *   - TS type `SabFlowOpLogEntry`.
 *   - Mongo model handle for the `sabflow_oplog` collection.
 *   - `nextSeq(docId)` — atomic monotonic per-doc sequence allocator.
 *   - `appendOpLogEntry({ docId, clientId, update })` — auto-assigns seq.
 *
 * Out of scope (owned by other Phase 2 sub-tasks — do not add here):
 *   - Snapshot (`sabflow_docs`) shape / repo (sub-task #1).
 *   - R2 cold tier (#3).
 *   - Index registration + TTL policy (#4).
 *   - Compaction worker (#5), TTL/GC cron (#6).
 *   - Repo facade `load/save/append/compact` (#7).
 *   - Workspace RBAC guards (#8) — callers higher up the stack pass through
 *     the repo layer (#7) which enforces `workspaceId`. This file
 *     intentionally does **not** take `workspaceId` because the ADR pins the
 *     uniqueness/ordering invariant on `(docId, seq)` only, and adding a
 *     workspace arg here would duplicate the repo's enforcement and create
 *     a second seam where guards could be bypassed.
 *
 * Storage substrate note:
 *   SabNode uses the **native `mongodb` driver** via `connectToDatabase()`
 *   from `@/lib/mongodb`. The project does not depend on Mongoose
 *   (see `package.json` — no `mongoose` entry). The Phase 2 plan / task
 *   brief references "Mongoose schema/model" generically; the actual
 *   implementation matches SabNode's existing convention (raw collection
 *   handle + typed shape) so this file composes with the rest of the
 *   codebase (e.g. `src/lib/sabflow/db.ts`).
 */

import 'server-only';

import { Binary, ObjectId, type Collection, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Append-only Yjs update row.
 *
 * Mirrors ADR §2.2 minus fields owned by sibling sub-tasks
 * (`workspaceId`, `size`, `baseVersion`) which are written by the repo
 * facade (#7) — this sub-task is responsible only for the doc/seq/payload
 * skeleton and the monotonic seq allocator.
 */
export interface SabFlowOpLogEntry {
  /** Mongo `_id`. */
  _id: ObjectId;
  /** Parent doc id — FK → `sabflow_docs._id`. */
  docId: ObjectId;
  /** Monotonic per-(`docId`) sequence number. Allocated by `nextSeq`. */
  seq: number;
  /** Yjs `clientID` of the originator (uint32 stringified). */
  clientId: string;
  /**
   * Raw Yjs update bytes (wire-format, NOT a state-vector diff).
   * Stored as BSON `Binary` (subtype 0).
   */
  update: Binary;
  /** Server-assigned timestamp. */
  ts: Date;
}

/** Input shape for {@link appendOpLogEntry}. */
export interface AppendOpLogInput {
  docId: ObjectId | string;
  clientId: string;
  /** Yjs update bytes — accepts a `Buffer` or `Uint8Array`. */
  update: Buffer | Uint8Array;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────────────────── */

/** Collection name fixed by ADR §2.2. */
export const SABFLOW_OPLOG_COLLECTION = 'sabflow_oplog';

/**
 * Counters collection used by {@link nextSeq}.
 *
 * Chosen approach for atomic monotonic seq allocation:
 *   `findOneAndUpdate({ _id: docId }, { $inc: { seq: 1 } },
 *                     { upsert: true, returnDocument: 'after' })`
 *
 * Why a dedicated counters collection (and not `$inc` on `sabflow_docs`)?
 *   1. `sabflow_docs` is the snapshot row — it gets rewritten on every
 *      compaction. Folding the seq counter into it would contend the
 *      snapshot write path on a hot field, and worse, an in-progress
 *      compaction could read a stale `seq` while a concurrent append
 *      bumps it.
 *   2. A standalone counters doc keyed by `docId` keeps the write contention
 *      surface small and aligns with the ADR §5.1 note:
 *      "`appendUpdate` allocates `seq` via a per-doc counter (Mongo
 *      `findOneAndUpdate` with `$inc` on a `sabflow_doc_seq` counter doc)".
 *   3. MongoDB guarantees atomicity for `findOneAndUpdate` on a single
 *      document, which is exactly what we need: the increment + read of
 *      the returned `seq` happen as one operation, so two concurrent
 *      callers cannot observe the same `seq`.
 *
 * The Phase 3 WS gateway may later front this with a Redis `INCR` + a
 * periodic sync into Mongo for lower latency (also noted in the ADR).
 * This file ships the Mongo-only baseline.
 */
export const SABFLOW_DOC_SEQ_COLLECTION = 'sabflow_doc_seq';

/* ──────────────────────────────────────────────────────────────────────────
 * Internal: collection handles
 * ──────────────────────────────────────────────────────────────────────── */

async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

/** Returns the typed handle for the `sabflow_oplog` collection. */
export async function SabFlowOpLogModel(): Promise<Collection<SabFlowOpLogEntry>> {
  const db = await getDb();
  return db.collection<SabFlowOpLogEntry>(SABFLOW_OPLOG_COLLECTION);
}

/** Internal: counters collection (`sabflow_doc_seq`) used by `nextSeq`. */
interface SabFlowDocSeqRow {
  /** `docId` — the counter key. */
  _id: ObjectId;
  /** Last allocated sequence number. */
  seq: number;
}

async function getSeqCollection(): Promise<Collection<SabFlowDocSeqRow>> {
  const db = await getDb();
  return db.collection<SabFlowDocSeqRow>(SABFLOW_DOC_SEQ_COLLECTION);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────── */

function asObjectId(value: ObjectId | string): ObjectId {
  return value instanceof ObjectId ? value : new ObjectId(value);
}

function toBinary(update: Buffer | Uint8Array): Binary {
  // BSON subtype 0 = generic binary; correct for opaque payloads like
  // raw Yjs update bytes. Avoids the deprecated subtype 2 default.
  const buf = Buffer.isBuffer(update) ? update : Buffer.from(update);
  return new Binary(buf, Binary.SUBTYPE_DEFAULT);
}

/**
 * Atomically allocate the next monotonic sequence number for `docId`.
 *
 * Approach (documented for reviewers, see comment on
 * {@link SABFLOW_DOC_SEQ_COLLECTION}):
 *   `findOneAndUpdate({ _id: docId }, { $inc: { seq: 1 } },
 *                     { upsert: true, returnDocument: 'after' })`.
 *
 * Guarantees:
 *   - Strictly monotonic per `docId` (no gaps from concurrent callers — a
 *     loser of a race still gets the next value).
 *   - First call upserts the counter at `seq = 1`.
 *   - No cross-doc coupling: counters are per-doc rows.
 *
 * Note on gaps: a failed `appendOpLogEntry` after `nextSeq` succeeded
 * leaves a hole in the oplog. The compaction worker (#5) and the
 * `(docId, seq)` UNIQUE index (#4) tolerate this — readers iterate by
 * `seq` ascending and apply whatever exists; missing seqs are no-ops
 * for Yjs `applyUpdate`.
 */
export async function nextSeq(docId: ObjectId | string): Promise<number> {
  const col = await getSeqCollection();
  const id = asObjectId(docId);

  const result = await col.findOneAndUpdate(
    { _id: id },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );

  // Driver returns the post-update doc when `returnDocument: 'after'` and
  // `upsert: true` — `seq` is always defined post-`$inc`.
  const seq = result?.seq;
  if (typeof seq !== 'number' || !Number.isFinite(seq)) {
    throw new Error(
      `[sabflow_oplog] nextSeq: counter for docId=${id.toHexString()} ` +
        `returned a non-numeric seq (got ${String(seq)})`,
    );
  }
  return seq;
}

/**
 * Append a single Yjs update row to `sabflow_oplog`.
 *
 * Allocates a fresh `seq` via {@link nextSeq}, wraps `update` as BSON
 * `Binary` (subtype 0), stamps a server-side `ts`, and inserts.
 *
 * Returns the inserted entry (with the assigned `_id`, `seq`, and `ts`).
 *
 * Caller responsibilities (enforced by sibling sub-tasks, NOT this file):
 *   - Workspace / RBAC checks — done by the repo facade (#7).
 *   - `size` / `baseVersion` fields — written by the repo facade (#7).
 *   - Index creation (`(docId, seq)` UNIQUE, TTL on `ts`) — sub-task #4.
 */
export async function appendOpLogEntry(
  input: AppendOpLogInput,
): Promise<SabFlowOpLogEntry> {
  const docId = asObjectId(input.docId);
  const seq = await nextSeq(docId);

  const entry: SabFlowOpLogEntry = {
    _id: new ObjectId(),
    docId,
    seq,
    clientId: input.clientId,
    update: toBinary(input.update),
    ts: new Date(),
  };

  const col = await SabFlowOpLogModel();
  await col.insertOne(entry);
  return entry;
}
