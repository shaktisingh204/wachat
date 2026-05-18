/**
 * SabFlow persistence — repo layer.
 *
 * Track A · Phase 2 · sub-task #7. Spec: docs/adr/sabflow-persistence.md §5.1.
 *
 * Scope (this file only):
 *   - Typed, tenant-scoped helpers over the three doc-side collections
 *     (`sabflow_docs`, `sabflow_oplog`, `sabflow_doc_shares`).
 *   - Cross-tenant safety: every read/write is filtered by `workspaceId`.
 *     On a mismatch we return `null` / `[]` / `false` — never throw a raw
 *     "doc not found" so we don't leak existence across tenants (ADR §5.2 step 1).
 *
 * Out of scope (owned by siblings, do NOT inline here):
 *   - Mongo model definitions / collection bootstrap → `./models.ts`
 *     (Phase 2 sub-tasks #1–#3). We import nothing from there; all model
 *     surfaces are placeholder interfaces below.
 *   - Snapshot / share / oplog domain types → `./snapshot.ts`, `./shares.ts`,
 *     `./oplog.ts` (Phase 2 sub-tasks #4–#6). We FORWARD-DECLARE the shapes
 *     used in this file's public signatures so callers stay decoupled.
 *   - Compaction & advisory locking → `./compaction.ts` (Phase 2 sub-task #9).
 *     This repo performs no Redis ops, no `SETNX`, no lock acquisition;
 *     `saveSnapshot` is conditional-on-version only (optimistic concurrency,
 *     ADR §6 step 6) and assumes the compaction worker is the only writer.
 *   - R2 cold-tier rehydration → `./coldTier.ts` (Phase 2 sub-task #10).
 *     `loadDoc` here returns the doc as-stored; if `coldTier != null` the
 *     caller is expected to route through the rehydration helper first.
 */

import type { ObjectId } from 'mongodb';

// ---------------------------------------------------------------------------
// FORWARD-DECLARED types — actual definitions live in sibling files.
// These mirror the shapes specified in docs/adr/sabflow-persistence.md §2.
// Keep these minimal — anything richer belongs in the owning sibling.
// ---------------------------------------------------------------------------

// FORWARD-DECLARED: src/lib/sabflow/persistence/snapshot.ts
export type SabFlowDocSnapshot = {
  _id: ObjectId;
  workspaceId: ObjectId;
  ownerId: ObjectId;
  name: string;
  version: number;
  versionId: string;
  snapshot: Buffer | null;
  snapshotSize: number;
  snapshotSeq: number;
  schemaVersion: number;
  settings: Record<string, unknown>;
  meta: Record<string, unknown>;
  tags: string[];
  triggerCount: number;
  active: boolean;
  coldTier: {
    storage: 'r2';
    key: string;
    movedAt: Date;
    snapshotSize: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  lastEditorId: ObjectId | null;
  deletedAt: Date | null;
};

// FORWARD-DECLARED: src/lib/sabflow/persistence/shares.ts
export type SabFlowDocShare = {
  _id: ObjectId;
  docId: ObjectId;
  workspaceId: ObjectId;
  principal: {
    kind: 'user' | 'group' | 'link';
    id: ObjectId | string;
  };
  role: SabFlowRole;
  grantedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
};

// FORWARD-DECLARED: src/lib/sabflow/persistence/oplog.ts
export type SabFlowOpLogEntry = {
  _id: ObjectId;
  docId: ObjectId;
  workspaceId: ObjectId;
  seq: number;
  clientId: string;
  update: Buffer;
  size: number;
  ts: Date;
  baseVersion: number;
};

/**
 * Role-rank table — ADR §5.2 step 4.
 * `viewer < commenter < editor < admin < owner`
 * The public `canAccess` API constrains `requiredRole` to the four levels
 * callers actually request today; `commenter` exists internally for ranking
 * but is never asked for as a required threshold from this layer (it's a
 * Phase 8 read-only role).
 */
const ROLE_RANK: Record<SabFlowRole, number> = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  admin: 4,
  owner: 5,
};

export type SabFlowRole = 'viewer' | 'commenter' | 'editor' | 'admin' | 'owner';
export type SabFlowRequiredRole = 'viewer' | 'editor' | 'admin' | 'owner';

// ---------------------------------------------------------------------------
// Placeholder Mongo surfaces.
//
// We do NOT import concrete collections from `./models.ts` (sibling owns
// them). Instead we declare the minimum collection shape this repo needs
// and resolve it through `getCollections()` — which the model sibling will
// register against in Phase 2 sub-task #2. Until then this returns a
// stub that throws on use; the public functions below are still
// type-checkable in isolation.
// ---------------------------------------------------------------------------

type Filter = Record<string, unknown>;
type Update = Record<string, unknown>;

interface CollectionLike<T> {
  findOne(filter: Filter): Promise<T | null>;
  find(filter: Filter, opts?: { limit?: number; sort?: Filter; skip?: number }): {
    toArray(): Promise<T[]>;
  };
  insertOne(doc: Partial<T>): Promise<{ insertedId: ObjectId }>;
  updateOne(
    filter: Filter,
    update: Update,
    opts?: { upsert?: boolean }
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId?: ObjectId | null }>;
  findOneAndUpdate(
    filter: Filter,
    update: Update,
    opts?: { upsert?: boolean; returnDocument?: 'before' | 'after' }
  ): Promise<T | null>;
}

interface SabFlowCollections {
  docs: CollectionLike<SabFlowDocSnapshot>;
  oplog: CollectionLike<SabFlowOpLogEntry>;
  shares: CollectionLike<SabFlowDocShare>;
  // Per-doc seq counter — ADR §5.1 (`sabflow_doc_seq` analogue, $inc allocator).
  seqCounters: CollectionLike<{ _id: ObjectId; docId: ObjectId; workspaceId: ObjectId; next: number }>;
}

// Sibling (`./models.ts`, Phase 2 sub-task #2) will set this via a register
// hook. Keeping it as a module-level slot avoids a hard import cycle while
// preserving a single integration point.
let _collections: SabFlowCollections | null = null;

/** @internal — invoked by `./models.ts` after collection bootstrap. */
export function __registerSabFlowCollections(c: SabFlowCollections): void {
  _collections = c;
}

function getCollections(): SabFlowCollections {
  if (!_collections) {
    throw new Error(
      '[sabflow/persistence/repo] collections not registered — ' +
        'sibling ./models.ts must call __registerSabFlowCollections() during boot.'
    );
  }
  return _collections;
}

// ---------------------------------------------------------------------------
// Helpers (local; not exported).
// ---------------------------------------------------------------------------

function isObjectIdLike(v: unknown): v is ObjectId | string {
  if (v == null) return false;
  if (typeof v === 'string') return v.length > 0;
  return typeof (v as { toHexString?: unknown }).toHexString === 'function';
}

/**
 * Cross-tenant safety guard — refuse to issue a query if either arg is
 * missing/blank. Returning `null`/`false`/`[]` from the caller is correct
 * per the requirements; we never throw a raw error here, but we DO refuse
 * the query so an absent `workspaceId` never accidentally widens to a
 * cross-tenant scan.
 */
function tenantGuard(workspaceId: unknown, docId?: unknown): boolean {
  if (!isObjectIdLike(workspaceId)) return false;
  if (docId !== undefined && !isObjectIdLike(docId)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Public API — see ADR §5.1.
// ---------------------------------------------------------------------------

/**
 * Load a doc by id, scoped to `workspaceId`. Returns `null` on tenant
 * mismatch, soft-deleted rows, or genuine 404 — callers must not
 * distinguish (ADR §5.2 step 1: do not leak cross-tenant existence).
 *
 * NOTE: returns the snapshot row AS STORED. If `coldTier != null` the
 * caller must route through `./coldTier.ts` rehydration before treating
 * `.snapshot` as the source-of-truth Yjs state.
 */
export async function loadDoc(
  workspaceId: ObjectId | string,
  docId: ObjectId | string
): Promise<SabFlowDocSnapshot | null> {
  if (!tenantGuard(workspaceId, docId)) return null;

  const { docs } = getCollections();
  const row = await docs.findOne({
    _id: docId,
    workspaceId,
    deletedAt: null,
  });
  return row ?? null;
}

/**
 * Append a CRDT update to the oplog for `(workspaceId, docId)`.
 *
 * `seq` allocation is performed via a per-doc counter document (ADR §5.1:
 * "Mongo `findOneAndUpdate` with `$inc`"). The gateway-resident Redis path
 * is Phase 3 work; this layer always goes through Mongo so background
 * services (compaction tests, admin tooling) can append safely without a
 * Redis dep.
 *
 * On tenant mismatch (workspaceId/docId pair does not resolve to a
 * non-deleted doc) we return `{ seq: -1 }` after performing no writes.
 * Callers MUST treat `seq < 0` as a failed append.
 */
export async function appendUpdate(
  workspaceId: ObjectId | string,
  docId: ObjectId | string,
  clientId: string,
  update: Buffer
): Promise<{ seq: number }> {
  if (!tenantGuard(workspaceId, docId)) return { seq: -1 };
  if (!clientId || !Buffer.isBuffer(update) || update.length === 0) {
    return { seq: -1 };
  }

  const { docs, oplog, seqCounters } = getCollections();

  // Tenant-fence: the doc must exist in this workspace AND not be soft-deleted.
  const doc = await docs.findOne({ _id: docId, workspaceId, deletedAt: null });
  if (!doc) return { seq: -1 };

  // Allocate seq via per-doc counter (atomic $inc).
  const counter = await seqCounters.findOneAndUpdate(
    { docId, workspaceId },
    { $inc: { next: 1 }, $setOnInsert: { docId, workspaceId } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = counter?.next ?? -1;
  if (seq < 0) return { seq: -1 };

  await oplog.insertOne({
    docId: docId as ObjectId,
    workspaceId: workspaceId as ObjectId,
    seq,
    clientId,
    update,
    size: update.length,
    ts: new Date(),
    baseVersion: doc.version,
  });

  return { seq };
}

/**
 * Persist a new snapshot generation for a doc. Conditional on `version`:
 * we only succeed if the doc's current `version` matches
 * `snapshot.version - 1` (or 0 → 1 for the first save). This is the
 * optimistic-concurrency fence from ADR §6 step 6 — if a competing
 * compactor advanced the version under us, we abort and the caller's
 * fold result is discarded.
 *
 * No locking is performed here — Redis advisory locks are the compaction
 * sibling's responsibility (ADR §6 step 1, owned by `./compaction.ts`).
 */
export async function saveSnapshot(
  workspaceId: ObjectId | string,
  snapshot: SabFlowDocSnapshot
): Promise<void> {
  if (!tenantGuard(workspaceId, snapshot?._id)) return;
  if (!snapshot || snapshot.workspaceId == null) return;
  // Defence-in-depth: refuse a snapshot whose embedded workspaceId
  // disagrees with the explicit arg — guards against accidental cross-
  // tenant writes if a caller hand-rolled the snapshot.
  if (String(snapshot.workspaceId) !== String(workspaceId)) return;

  const { docs } = getCollections();
  const expectedPriorVersion = snapshot.version - 1;

  await docs.updateOne(
    {
      _id: snapshot._id,
      workspaceId,
      version: expectedPriorVersion,
      deletedAt: null,
    },
    {
      $set: {
        version: snapshot.version,
        versionId: snapshot.versionId,
        snapshot: snapshot.snapshot,
        snapshotSize: snapshot.snapshotSize,
        snapshotSeq: snapshot.snapshotSeq,
        schemaVersion: snapshot.schemaVersion,
        settings: snapshot.settings,
        meta: snapshot.meta,
        tags: snapshot.tags,
        triggerCount: snapshot.triggerCount,
        active: snapshot.active,
        coldTier: snapshot.coldTier,
        lastEditorId: snapshot.lastEditorId,
        updatedAt: snapshot.updatedAt ?? new Date(),
      },
    }
  );
}

/**
 * List non-deleted docs in a workspace, newest-first by `updatedAt`.
 * Cursor is the stringified `updatedAt` ms of the last item from the
 * previous page (opaque to callers).
 *
 * Returns `[]` on tenant guard failure (per cross-tenant safety rule).
 */
export async function listDocs(
  workspaceId: ObjectId | string,
  opts?: { limit?: number; cursor?: string }
): Promise<SabFlowDocSnapshot[]> {
  if (!tenantGuard(workspaceId)) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const filter: Filter = { workspaceId, deletedAt: null };

  if (opts?.cursor) {
    const cursorMs = Number(opts.cursor);
    if (Number.isFinite(cursorMs) && cursorMs > 0) {
      filter.updatedAt = { $lt: new Date(cursorMs) };
    }
  }

  const { docs } = getCollections();
  const rows = await docs.find(filter, { limit, sort: { updatedAt: -1 } }).toArray();
  return rows ?? [];
}

/**
 * Return all share rows for a doc, scoped to `workspaceId`.
 * `[]` on tenant mismatch or unknown doc.
 */
export async function getDocShares(
  workspaceId: ObjectId | string,
  docId: ObjectId | string
): Promise<SabFlowDocShare[]> {
  if (!tenantGuard(workspaceId, docId)) return [];

  const { docs, shares } = getCollections();

  // Confirm the doc lives in this workspace before exposing its share rows,
  // otherwise a caller could enumerate share rows by guessing docId.
  const doc = await docs.findOne({ _id: docId, workspaceId, deletedAt: null });
  if (!doc) return [];

  const rows = await shares.find({ docId, workspaceId }).toArray();
  return rows ?? [];
}

/**
 * RBAC gate — ADR §5.2.
 *
 * Resolution order:
 *   1. Tenant-fence on the doc (else `false`, no existence leak).
 *   2. Doc owner shortcut — `ownerId === userId` always satisfies.
 *   3. Lookup user-principal share row; compare role rank to `requiredRole`.
 *
 * Workspace-admin escalation (ADR §5.2 step 3) is NOT performed here —
 * that requires the SabNode workspace RBAC layer (`sabflow.doc.*` keys
 * registered in Phase 1 #7) and is wired in by the auth sibling. This
 * function only answers from doc-side rows. The auth sibling layers its
 * own check on top via `OR canAccess(...)`.
 */
export async function canAccess(
  workspaceId: ObjectId | string,
  docId: ObjectId | string,
  userId: ObjectId | string,
  requiredRole: SabFlowRequiredRole
): Promise<boolean> {
  if (!tenantGuard(workspaceId, docId)) return false;
  if (!isObjectIdLike(userId)) return false;
  if (!(requiredRole in ROLE_RANK)) return false;

  const { docs, shares } = getCollections();

  const doc = await docs.findOne({ _id: docId, workspaceId, deletedAt: null });
  if (!doc) return false;

  // Owner shortcut.
  if (String(doc.ownerId) === String(userId)) {
    return ROLE_RANK.owner >= ROLE_RANK[requiredRole];
  }

  const share = await shares.findOne({
    docId,
    workspaceId,
    'principal.kind': 'user',
    'principal.id': userId,
    // Either no expiry, or expiry in the future. (Mongo `$or` shape.)
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
  if (!share) return false;

  const heldRank = ROLE_RANK[share.role] ?? 0;
  const requiredRank = ROLE_RANK[requiredRole];
  return heldRank >= requiredRank;
}
