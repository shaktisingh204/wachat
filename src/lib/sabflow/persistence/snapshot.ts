/**
 * SabFlow persistence — `sabflow_docs` snapshot collection
 *
 * Track A · Phase 2 · sub-task #1
 *
 * Models the snapshot baseline per SabFlow doc (n8n `workflow_entity` analogue).
 * The shape, retention, and RBAC join semantics are fixed by
 * `docs/adr/sabflow-persistence.md` §2.1. Indexes are intentionally NOT
 * declared here — sibling sub-task #4 owns the index bootstrap. CRUD,
 * oplog, cold-tier move, and worker logic are owned by other siblings.
 *
 * SabNode uses the native MongoDB driver (not Mongoose); the
 * `connectToDatabase()` helper from `@/lib/mongodb` is the canonical
 * connection accessor. We expose a typed `Collection<SabFlowDocSnapshot>`
 * via `getSabFlowDocCollection()` so the rest of the persistence layer
 * can talk to a single source of truth.
 */

import 'server-only';

import type { Binary, Collection, ObjectId } from 'mongodb';
import { z } from 'zod';

import { connectToDatabase } from '@/lib/mongodb';

/* ══════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════ */

/** Mongo collection name. Single source of truth — do not inline elsewhere. */
export const SABFLOW_DOCS_COLLECTION = 'sabflow_docs';

/**
 * The SabFlow doc-schema version this build writes. Bump when the
 * in-memory Y.Doc structure changes in a way clients must migrate
 * (Phase 5 client SDK — `Schema migration runner`).
 */
export const SABFLOW_DOC_SCHEMA_VERSION = 1;

/* ══════════════════════════════════════════════════════════
   TypeScript types — mirror ADR §2.1
   ══════════════════════════════════════════════════════════ */

/**
 * Pointer to a cold-tier snapshot stored in R2 via SabFiles.
 * `null` on the parent doc when the snapshot is still hot.
 *
 * Key shape (required, see ADR §4):
 *   `sabflow/<workspaceId>/<docId>/<version>.bin`
 */
export interface SabFlowDocColdTier {
  /** Storage backend identifier. Only `'r2'` for now (SabFiles-routed). */
  storage: 'r2';
  /** Full SabFiles object key. */
  key: string;
  /** When the cold-tier worker moved the snapshot out of Mongo. */
  movedAt: Date;
  /** Size in bytes of the cold-tier snapshot blob. */
  snapshotSize: number;
}

/**
 * SabFlow snapshot document — one row per editable flow doc.
 *
 * IMPORTANT: every query MUST be `workspaceId`-scoped. The repo layer
 * (sibling sub-task #7) enforces this; never query this collection by
 * `_id` alone from outside `src/lib/sabflow/persistence/*`.
 */
export interface SabFlowDocSnapshot {
  /** SabFlow doc id. Also used as the Yjs room id. */
  _id: ObjectId;

  /** Tenant scope — MANDATORY on every query. */
  workspaceId: ObjectId;

  /**
   * User id of the current owner. Transferable via Phase 8 sub-task 8
   * ("Owner transfer"). The `owner` row in `sabflow_doc_shares` is the
   * canonical RBAC representation; this field is the denormalised pointer
   * used by the "My docs" view.
   */
  ownerId: ObjectId;

  /** Display name, <=128 chars. Enforced by the Zod schema below. */
  name: string;

  /**
   * Monotonic snapshot generation. Bumped by the compaction worker
   * (sibling sub-task #5) on every successful fold. Distinct from
   * `versionId`, which is the n8n-compat optimistic-concurrency token.
   */
  version: number;

  /**
   * UUID string. Mirrors n8n's `workflow_entity.versionId` — clients
   * submit it on save and the server rejects stale writes.
   */
  versionId: string;

  /**
   * Hot baseline: `Y.encodeStateAsUpdate(doc)` bytes.
   * Set to `null` when the doc is cold (then `coldTier` is non-null).
   * Stored as BSON `Binary` (subtype 0) in Mongo; the TS type allows
   * `Buffer` for write paths and `Binary` for read paths.
   */
  snapshot: Binary | Buffer | null;

  /** Size in bytes of `snapshot`. 0 when cold. */
  snapshotSize: number;

  /** SabFlow doc-schema version, for client-side migrations. */
  schemaVersion: number;

  /**
   * n8n-compat settings bag (executionOrder, errorWorkflow, timezone,
   * saveDataOnError, callerPolicy, ...). Free-form object — Track B
   * tightens this on the executor side.
   */
  settings: Record<string, unknown>;

  /** UI-only meta (onboarding flags, last viewport, etc.). */
  meta: Record<string, unknown>;

  /**
   * Denormalised tag ids. Canonical list lives in `sabflow_tags`
   * (separate Phase 2 sub-task). Kept here for index-only tag filter.
   */
  tags: string[];

  /** Denormalised trigger count (mirrors n8n). */
  triggerCount: number;

  /** Trigger-registration flag (mirrors n8n). */
  active: boolean;

  /** R2 cold-tier pointer; `null` while hot. */
  coldTier: SabFlowDocColdTier | null;

  createdAt: Date;
  updatedAt: Date;

  /** User who applied the most recent op (denormalised from oplog). */
  lastEditorId: ObjectId | null;

  /** Soft delete (n8n parity). `null` for live docs. */
  deletedAt: Date | null;
}

/* ══════════════════════════════════════════════════════════
   Zod schema — runtime validation on writes
   ══════════════════════════════════════════════════════════
   The repo layer (sibling sub-task #7) calls `.parse()` before any
   insert/replace so a malformed document can never land in Mongo.
   Read paths intentionally do NOT validate — Mongo is the source of
   truth and we'd rather surface a TS-level mismatch than silently
   reject historical rows.
*/

/**
 * Custom ObjectId predicate — works whether the caller passes a real
 * `ObjectId` instance or a 24-char hex string (the latter is common in
 * server-action call sites that receive ids from the client).
 */
const objectIdLike = z.custom<ObjectId | string>(
  (val) => {
    if (val == null) return false;
    if (typeof val === 'string') return /^[a-f0-9]{24}$/i.test(val);
    // Duck-type ObjectId without importing the runtime class (keeps this
    // module lighter and avoids cycles).
    return (
      typeof val === 'object' &&
      val !== null &&
      typeof (val as { toHexString?: unknown }).toHexString === 'function'
    );
  },
  { message: 'Expected ObjectId or 24-char hex string' },
);

/** Bytes-like predicate for the `snapshot` field. */
const binaryLike = z.custom<Binary | Buffer | Uint8Array>(
  (val) => {
    if (val == null) return false;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(val)) return true;
    if (val instanceof Uint8Array) return true;
    // Duck-type BSON Binary.
    return (
      typeof val === 'object' &&
      val !== null &&
      (val as { _bsontype?: unknown })._bsontype === 'Binary'
    );
  },
  { message: 'Expected Buffer, Uint8Array, or BSON Binary' },
);

export const sabFlowDocColdTierSchema = z.object({
  storage: z.literal('r2'),
  key: z.string().min(1).max(512),
  movedAt: z.date(),
  snapshotSize: z.number().int().nonnegative(),
});

export const sabFlowDocSnapshotSchema = z.object({
  _id: objectIdLike,
  workspaceId: objectIdLike,
  ownerId: objectIdLike,
  name: z.string().min(1).max(128),
  version: z.number().int().nonnegative(),
  versionId: z.string().uuid(),
  snapshot: binaryLike.nullable(),
  snapshotSize: z.number().int().nonnegative(),
  schemaVersion: z.number().int().positive(),
  settings: z.record(z.string(), z.unknown()),
  meta: z.record(z.string(), z.unknown()),
  tags: z.array(z.string().min(1).max(64)),
  triggerCount: z.number().int().nonnegative(),
  active: z.boolean(),
  coldTier: sabFlowDocColdTierSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastEditorId: objectIdLike.nullable(),
  deletedAt: z.date().nullable(),
});

/* ══════════════════════════════════════════════════════════
   Collection accessor — exported as the project's `Model`
   ══════════════════════════════════════════════════════════ */

/**
 * Returns the typed Mongo collection for `sabflow_docs`.
 *
 * Mirrors the project pattern used elsewhere in `src/lib/sabflow/db.ts`
 * (`getSabFlowCollection`, `getVersionCollection`, ...). Index bootstrap
 * is owned by sibling sub-task #4 — do NOT call `createIndex` here.
 */
export async function getSabFlowDocCollection(): Promise<Collection<SabFlowDocSnapshot>> {
  const { db } = await connectToDatabase();
  return db.collection<SabFlowDocSnapshot>(SABFLOW_DOCS_COLLECTION);
}

/**
 * Canonical name for the model export. SabNode's persistence layers
 * (see `src/lib/sabflow/db.ts`) expose collections via async accessors
 * rather than Mongoose `model()` singletons; `SabFlowDocModel` is the
 * accessor, named to match the task contract.
 */
export const SabFlowDocModel = getSabFlowDocCollection;

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

/**
 * Build an empty `SabFlowDocSnapshot` ready for insertion. Caller is
 * responsible for `_id` allocation (Mongo auto-assigns on insert if
 * omitted) and for invoking the repo layer (sibling sub-task #7) which
 * runs `sabFlowDocSnapshotSchema.parse()` and writes to Mongo.
 *
 * The returned object intentionally omits `_id` so the Mongo driver
 * assigns a fresh ObjectId — callers that need a deterministic id
 * should set `_id` themselves before calling the repo.
 */
export function makeEmptySnapshot(
  workspaceId: ObjectId,
  ownerId: ObjectId,
  name: string,
): Omit<SabFlowDocSnapshot, '_id'> {
  const { randomUUID } = require('crypto') as typeof import('crypto');
  const now = new Date();
  return {
    workspaceId,
    ownerId,
    name,
    version: 0,
    versionId: randomUUID(),
    // A brand-new doc has no CRDT history yet; the client SDK will emit
    // the first update on the first edit. Storing an empty Buffer keeps
    // the field non-null until the first compaction generation lands.
    snapshot: Buffer.alloc(0),
    snapshotSize: 0,
    schemaVersion: SABFLOW_DOC_SCHEMA_VERSION,
    settings: {},
    meta: {},
    tags: [],
    triggerCount: 0,
    active: false,
    coldTier: null,
    createdAt: now,
    updatedAt: now,
    lastEditorId: ownerId,
    deletedAt: null,
  };
}
