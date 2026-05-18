/**
 * SabFlow doc-side index specifications.
 *
 * Source of truth: docs/adr/sabflow-persistence.md §3 (Indexes & retention).
 *
 * This module exports two things:
 *   - `SABFLOW_INDEX_SPECS`: a declarative list of `{ collection, keys, options }`
 *     describing every index Phase 2 expects on the doc-side collections.
 *   - `ensureSabflowIndexes(db)`: an idempotent bootstrap that calls
 *     `createIndex` for each spec. Safe to run repeatedly (MongoDB ignores
 *     duplicate index definitions with matching keys/options).
 *
 * NOTE on the driver:
 *   The ADR / task brief uses a mongoose-flavoured signature
 *   (`mongoose.Connection`). SabNode itself does not depend on mongoose —
 *   it uses the native `mongodb` driver (see src/lib/mongodb.ts). To match
 *   project conventions while preserving the task's intent (a generic
 *   "db handle" arg), the bootstrap accepts a `Db` from the native driver.
 *   Adapt at the caller if a mongoose connection ever needs to feed in
 *   (`conn.getClient().db()` returns a compatible handle).
 *
 * NOTE on sibling files:
 *   Per Phase 2 sub-task ownership, this module deliberately avoids
 *   importing sibling SabFlow model files. Collection names are string
 *   literals here — the canonical source remains the ADR.
 */

import type { Db, IndexSpecification, CreateIndexesOptions } from 'mongodb';

/* ────────────────────────────────────────────────────────────
   Collection names (string-literal source of truth)
   ──────────────────────────────────────────────────────────── */

export const SABFLOW_DOCS_COLLECTION = 'sabflow_docs';
export const SABFLOW_OPLOG_COLLECTION = 'sabflow_oplog';
export const SABFLOW_DOC_SHARES_COLLECTION = 'sabflow_doc_shares';

/* ────────────────────────────────────────────────────────────
   TTL horizon
   ────────────────────────────────────────────────────────────
   ADR §3.2: oplog entries are reaped 7 days *post-compaction*. The
   compaction worker (§6) rewrites `ts` on folded rows to a tombstone
   past-timestamp so the TTL fires this many seconds later. Unfolded
   entries still expire eventually (24h hard floor preventing unbounded
   growth for abandoned docs), but for the index itself we set the
   post-compaction horizon. The compaction tombstone math (24h floor vs
   7-day grace) lives in the worker, not in the index.

   Trade-off vs `partialFilterExpression: { compacted: true }`: a partial
   filter would require the worker to flip a `compacted` flag and would
   leave unfolded docs immortal until compaction ever runs. The chosen
   approach (TTL-on-ts + worker-managed tombstone ts) is operationally
   simpler and matches the ADR's "hard floor 24h means even unfolded
   entries still age out if compaction never runs". */
const SABFLOW_OPLOG_TTL_DAYS = 7;
const SECONDS_PER_DAY = 24 * 60 * 60;
export const SABFLOW_OPLOG_TTL_SECONDS = SABFLOW_OPLOG_TTL_DAYS * SECONDS_PER_DAY;

/* ────────────────────────────────────────────────────────────
   Index spec shape
   ──────────────────────────────────────────────────────────── */

export interface SabflowIndexSpec {
  /** Mongo collection name (string literal, not a model reference). */
  collection: string;
  /** Index keys, e.g. `{ docId: 1, seq: 1 }`. */
  keys: IndexSpecification;
  /** Mongo `createIndex` options (unique, sparse, TTL, partial, name, ...). */
  options: CreateIndexesOptions;
  /** Optional human-readable purpose — surfaced in `ensureSabflowIndexes` logs. */
  purpose?: string;
}

/* ────────────────────────────────────────────────────────────
   The contract — keep this list aligned with ADR §3
   ──────────────────────────────────────────────────────────── */

export const SABFLOW_INDEX_SPECS: readonly SabflowIndexSpec[] = [
  /* ── sabflow_oplog ──────────────────────────────────────── */
  {
    collection: SABFLOW_OPLOG_COLLECTION,
    keys: { docId: 1, seq: 1 },
    options: {
      name: 'docId_1_seq_1_unique',
      unique: true,
      background: true,
    },
    purpose:
      'Per-doc CRDT op ordering; uniqueness blocks duplicate seq numbers from racing gateways.',
  },
  {
    collection: SABFLOW_OPLOG_COLLECTION,
    keys: { ts: 1 },
    options: {
      name: 'ts_1_ttl',
      // 7-day post-compaction reap window. The compaction worker rewrites
      // `ts` on folded rows to schedule eviction; unfolded entries also
      // expire after this horizon (24h hard floor is enforced by the
      // worker's tombstone math, not by a partial filter — see file
      // header comment for the trade-off rationale).
      expireAfterSeconds: SABFLOW_OPLOG_TTL_SECONDS,
      background: true,
    },
    purpose: `TTL: oplog rows reaped ${SABFLOW_OPLOG_TTL_DAYS} days after compaction tombstones their ts.`,
  },
  {
    collection: SABFLOW_OPLOG_COLLECTION,
    keys: { workspaceId: 1, ts: -1 },
    options: { name: 'workspaceId_1_ts_-1', background: true },
    purpose: 'Workspace-scoped audit windows over the oplog.',
  },
  {
    collection: SABFLOW_OPLOG_COLLECTION,
    keys: { docId: 1, ts: 1 },
    options: { name: 'docId_1_ts_1', background: true },
    purpose: 'Time-window queries during compaction.',
  },

  /* ── sabflow_docs ───────────────────────────────────────── */
  {
    collection: SABFLOW_DOCS_COLLECTION,
    keys: { workspaceId: 1, updatedAt: -1 },
    options: { name: 'workspaceId_1_updatedAt_-1', background: true },
    purpose: 'Workspace dashboard list (recent first) — primary list path.',
  },
  {
    collection: SABFLOW_DOCS_COLLECTION,
    keys: { workspaceId: 1, ownerId: 1, updatedAt: -1 },
    options: { name: 'workspaceId_1_ownerId_1_updatedAt_-1', background: true },
    purpose: '"My docs" view filtered by owner.',
  },
  {
    collection: SABFLOW_DOCS_COLLECTION,
    // Optional text index per ADR §3.1 ("name lookup / autocomplete").
    // A text index can only cover one collection at a time and may be
    // disabled per-deployment; keeping it here so the spec is faithful
    // to the ADR. Mongo will accept this idempotently.
    keys: { workspaceId: 1, name: 'text' },
    options: {
      name: 'workspaceId_1_name_text',
      background: true,
      default_language: 'none',
    },
    purpose: 'Name lookup / autocomplete (optional text index).',
  },
  {
    collection: SABFLOW_DOCS_COLLECTION,
    keys: { workspaceId: 1, tags: 1 },
    options: { name: 'workspaceId_1_tags_1', background: true },
    purpose: 'Tag filter.',
  },
  {
    collection: SABFLOW_DOCS_COLLECTION,
    keys: { workspaceId: 1, active: 1 },
    options: { name: 'workspaceId_1_active_1', background: true },
    purpose: 'Active-trigger sweep handed off to Track B execution side.',
  },
  {
    collection: SABFLOW_DOCS_COLLECTION,
    keys: { deletedAt: 1 },
    options: {
      name: 'deletedAt_1_sparse',
      sparse: true,
      background: true,
    },
    purpose: 'Soft-delete cleanup worker.',
  },
  {
    collection: SABFLOW_DOCS_COLLECTION,
    keys: { 'coldTier.movedAt': 1 },
    options: {
      name: 'coldTier_movedAt_1_sparse',
      sparse: true,
      background: true,
    },
    purpose: 'Cold-tier admin / repair.',
  },

  /* ── sabflow_doc_shares ─────────────────────────────────── */
  {
    collection: SABFLOW_DOC_SHARES_COLLECTION,
    // ADR §3.3 spells this as `(docId, principal.kind, principal.id)` UNIQUE.
    // The task brief shorthand "{ docId:1, principal:1 } UNIQUE" is the
    // same intent expressed against the nested `principal` doc — we follow
    // the ADR's more precise form so unique-collisions resolve correctly.
    keys: { docId: 1, 'principal.kind': 1, 'principal.id': 1 },
    options: {
      name: 'docId_1_principalKind_1_principalId_1_unique',
      unique: true,
      background: true,
    },
    purpose: 'One grant per (doc, principal) — RBAC join uniqueness.',
  },
  {
    collection: SABFLOW_DOC_SHARES_COLLECTION,
    keys: { workspaceId: 1, 'principal.id': 1 },
    options: { name: 'workspaceId_1_principalId_1', background: true },
    purpose: '"What can this user/group see?" reverse lookup.',
  },
  {
    collection: SABFLOW_DOC_SHARES_COLLECTION,
    keys: { expiresAt: 1 },
    options: {
      name: 'expiresAt_1_ttl_sparse',
      // Share-link tokens carry a non-null `expiresAt`; user/group grants
      // do not. Sparse + TTL: only the timed rows participate in the
      // index and get auto-reaped on expiry.
      sparse: true,
      expireAfterSeconds: 0,
      background: true,
    },
    purpose: 'Share-link expiry — TTL evicts at `expiresAt`.',
  },
] as const;

/* ────────────────────────────────────────────────────────────
   Idempotent bootstrap
   ──────────────────────────────────────────────────────────── */

/**
 * Creates every index in `SABFLOW_INDEX_SPECS`. Idempotent — MongoDB's
 * `createIndex` is a no-op when an index with the same keys + options
 * already exists. Logs one line per spec.
 *
 * Throws (does not swallow) on the first failure so the caller — usually
 * `scripts/sabflow/create-indexes.ts` — can exit non-zero.
 *
 * @param db Native `mongodb` `Db` handle (see header note on driver choice).
 */
export async function ensureSabflowIndexes(db: Db): Promise<void> {
  const total = SABFLOW_INDEX_SPECS.length;
  let i = 0;

  for (const spec of SABFLOW_INDEX_SPECS) {
    i += 1;
    const label = `${spec.collection}.${spec.options.name ?? '<unnamed>'}`;
    const purpose = spec.purpose ? ` — ${spec.purpose}` : '';
    // eslint-disable-next-line no-console
    console.log(`[sabflow:indexes] (${i}/${total}) creating ${label}${purpose}`);
    try {
      const result = await db
        .collection(spec.collection)
        .createIndex(spec.keys, spec.options);
      // eslint-disable-next-line no-console
      console.log(`[sabflow:indexes] (${i}/${total}) ok: ${result}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[sabflow:indexes] (${i}/${total}) FAILED for ${label}:`, err);
      throw err;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[sabflow:indexes] done — ${total} indexes ensured`);
}
