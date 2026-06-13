import 'server-only';

/**
 * SabCRM — fractional ranking runtime (server-only).
 *
 * Persists a per-record fractional sort key so a kanban board can remember the
 * user's MANUAL card order across reloads. The pure key math lives in
 * `./ranking.ts` (re-exported here so callers only import this file); the Mongo
 * write-back follows the same scalar-envelope rules as `./scoring.server.ts`.
 *
 * ## Write-back envelope (mirrors `./scoring.server.ts` / `./ai-fields.server.ts`)
 *
 * The rank is written DIRECT to `sabcrm_records` as a single dotted `$set`:
 * `data.__rank` (a short base-62 STRING). `__rank` is a reserved system meta key
 * — it is NOT a declared object field and needs NO field provisioning (the rank
 * is meta, like `data.__ai` / `data.__score`). The write deliberately does NOT
 * bump the record's top-level `updatedAt`, so reordering a card never resets the
 * `time.elapsed` / deal-rotting idle clocks or re-triggers record-change
 * workflows (same rationale as the scoring + AI-field designs).
 *
 * Both the Rust read path and the native-Mongo store serve the same
 * `sabcrm_records` collection, so a scalar written into `data` here is visible
 * to both with zero crate change (two-store gotcha: scalar `data.*` writes are
 * safe; we never invent a new metadata path).
 *
 * Everything is best-effort: a downed DB must never break the drag-drop or the
 * mutation that triggered a backfill.
 */

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  generateKeyBetween,
  generateNKeysBetween,
  isValidKey,
  type Rankable,
  type RankAssignment,
} from './ranking';

export {
  generateKeyBetween,
  generateNKeysBetween,
  rebalance,
  sortByRank,
  isValidKey,
  DIGITS,
  BASE,
  type Rankable,
  type RankAssignment,
} from './ranking';

const RECORDS_COLL = 'sabcrm_records';

/** The reserved meta key the fractional sort key is stored under. */
export const RANK_FIELD = '__rank';
/** Dotted Mongo path of the rank meta scalar. */
const RANK_PATH = `data.${RANK_FIELD}`;

/** Cap on records backfilled per object in one sweep (mirrors the AI/score pass). */
const MAX_RECORDS_PER_SWEEP = 1000;

/** Loose record doc shape (Mongo read directly; tolerate missing fields). */
interface RankRecordDoc {
  _id: ObjectId | string;
  projectId?: string;
  object?: string;
  data?: Record<string, unknown>;
  createdAt?: string | Date;
  deletedAt?: string | Date | null;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** The valid base-62 rank stored on a record, or null when absent/invalid. */
function readRank(doc: RankRecordDoc | null | undefined): string | null {
  const v = doc?.data?.[RANK_FIELD];
  return typeof v === 'string' && isValidKey(v) ? v : null;
}

/** Read one record (project-scoped) by id, or null. */
async function readRecord(
  db: Db,
  projectId: string,
  recordId: string,
): Promise<RankRecordDoc | null> {
  if (!ObjectId.isValid(recordId)) return null;
  return (await db
    .collection(RECORDS_COLL)
    .findOne({ _id: new ObjectId(recordId), projectId })) as RankRecordDoc | null;
}

/** Write a single record's `data.__rank` (no `updatedAt` bump). */
async function writeRank(
  db: Db,
  projectId: string,
  id: ObjectId | string,
  rank: string,
): Promise<void> {
  const _id = id instanceof ObjectId ? id : new ObjectId(String(id));
  await db
    .collection(RECORDS_COLL)
    .updateOne({ _id, projectId }, { $set: { [RANK_PATH]: rank } });
}

/** The outcome of a {@link moveRecord} call. */
export interface MoveRecordResult {
  /** Whether a new rank was persisted. */
  moved: boolean;
  /** The record's new rank key (when moved). */
  rank?: string;
  /** Why the move was a no-op (record missing/trashed, bad ids, etc.). */
  detail?: string;
}

/**
 * Persist a manual reorder: place `recordId` strictly between its new
 * neighbours `beforeId` (the card that should sit ABOVE it) and `afterId` (the
 * card that should sit BELOW it). Either neighbour may be null (dropped at the
 * top or bottom of its column). Reads the neighbours' `data.__rank`, mints ONE
 * fresh key between them via {@link generateKeyBetween}, and writes it back —
 * NO neighbour is touched and `updatedAt` is NOT bumped.
 *
 * When a neighbour is missing a valid rank, it is backfilled lazily so the
 * bound is real before we squeeze between them (keeps the column converging
 * toward fully-ranked without a separate pass). Best-effort — never throws.
 *
 * @param projectId tenant scope (already gated by the action).
 * @param object    the object slug the record belongs to (defensive scope).
 * @param recordId  the dragged record's id.
 * @param beforeId  id of the neighbour now ABOVE the card, or null for top.
 * @param afterId   id of the neighbour now BELOW the card, or null for bottom.
 */
export async function moveRecord(
  projectId: string,
  object: string,
  recordId: string,
  beforeId: string | null,
  afterId: string | null,
): Promise<MoveRecordResult> {
  try {
    if (!projectId || !object || !recordId || !ObjectId.isValid(recordId)) {
      return { moved: false, detail: 'invalid arguments' };
    }
    if (beforeId && beforeId === recordId) beforeId = null;
    if (afterId && afterId === recordId) afterId = null;

    const { db } = await connectToDatabase();
    const rec = await readRecord(db, projectId, recordId);
    if (!rec || rec.deletedAt) {
      return { moved: false, detail: 'record missing or trashed' };
    }

    // Resolve the two bounds, backfilling a neighbour that has no valid rank so
    // we always squeeze between REAL keys (a missing bound is treated as open).
    const before = beforeId
      ? await ensureNeighborRank(db, projectId, beforeId)
      : null;
    const after = afterId
      ? await ensureNeighborRank(db, projectId, afterId)
      : null;

    // Bounds must be ordered for a clean midpoint; if a stale read crossed them
    // (concurrent move), drop the upper bound so we still land after `before`.
    const lo = before;
    const hi = after !== null && (lo === null || after > lo) ? after : null;

    const rank = generateKeyBetween(lo, hi);
    await writeRank(db, projectId, rec._id, rank);
    return { moved: true, rank };
  } catch (e) {
    return { moved: false, detail: e instanceof Error ? e.message : 'move failed' };
  }
}

/**
 * Return a neighbour's valid rank, lazily backfilling one when missing. Reads
 * the record; if it already has a valid `data.__rank` that is returned as-is,
 * otherwise a fresh open-ended key is minted, persisted, and returned. Returns
 * null only when the neighbour record can't be read.
 */
async function ensureNeighborRank(
  db: Db,
  projectId: string,
  neighborId: string,
): Promise<string | null> {
  const doc = await readRecord(db, projectId, neighborId);
  if (!doc || doc.deletedAt) return null;
  const existing = readRank(doc);
  if (existing) return existing;
  const rank = generateKeyBetween(null, null);
  await writeRank(db, projectId, doc._id, rank);
  return rank;
}

/** Report from {@link ensureRanks}. */
export interface EnsureRanksResult {
  /** Live records examined. */
  scanned: number;
  /** Records that received a fresh rank this pass. */
  updated: number;
}

/**
 * Backfill `data.__rank` for every live record of an object that is missing a
 * valid one, WITHOUT disturbing the records that already have a rank.
 *
 * Strategy: read all live records, split into already-ranked vs un-ranked
 * (capped at {@link MAX_RECORDS_PER_SWEEP}). The un-ranked records are appended
 * AFTER the highest existing rank in creation order, so a backfill is stable
 * and never reshuffles cards a user already arranged. Returns a small report.
 * Best-effort — never throws.
 */
export async function ensureRanks(
  projectId: string,
  object: string,
  limit = MAX_RECORDS_PER_SWEEP,
): Promise<EnsureRanksResult> {
  try {
    if (!projectId || !object) return { scanned: 0, updated: 0 };
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object, deletedAt: { $in: [null] } })
      .limit(Math.min(limit, MAX_RECORDS_PER_SWEEP))
      .toArray()) as unknown as RankRecordDoc[];
    if (recs.length === 0) return { scanned: 0, updated: 0 };

    // Highest existing valid rank → the lower bound the backfill appends after.
    let maxRank: string | null = null;
    const unranked: RankRecordDoc[] = [];
    for (const rec of recs) {
      const r = readRank(rec);
      if (r) {
        if (maxRank === null || r > maxRank) maxRank = r;
      } else {
        unranked.push(rec);
      }
    }
    if (unranked.length === 0) return { scanned: recs.length, updated: 0 };

    // Deterministic, stable order for the appended block: by creationid then id.
    unranked.sort((a, b) => {
      const ca = parseMs(a.createdAt);
      const cb = parseMs(b.createdAt);
      if (ca !== cb) return ca - cb;
      return idHex(a._id) < idHex(b._id) ? -1 : 1;
    });

    const keys = generateNKeysBetween(maxRank, null, unranked.length);
    let updated = 0;
    for (let i = 0; i < unranked.length; i++) {
      await writeRank(db, projectId, unranked[i]._id, keys[i]);
      updated += 1;
    }
    return { scanned: recs.length, updated };
  } catch {
    return { scanned: 0, updated: 0 };
  }
}

/** Parse a Date | RFC3339 string to epoch ms (0 when absent/unparseable). */
function parseMs(v: unknown): number {
  if (!v) return 0;
  const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

/**
 * Backfill ranks for EVERY object that has at least one ranked-or-rankable
 * record in the project. The scheduler backstop entry point — catches records
 * created out-of-band (CSV import / public API / the Rust write path) that
 * never went through {@link moveRecord}. Returns a per-object report.
 * Best-effort.
 */
export async function ensureRanksForAllObjects(
  projectId: string,
  perObjectLimit = 500,
): Promise<Array<{ objectSlug: string; scanned: number; updated: number }>> {
  const out: Array<{ objectSlug: string; scanned: number; updated: number }> = [];
  try {
    if (!projectId) return out;
    const { db } = await connectToDatabase();
    const objects = (await db
      .collection(RECORDS_COLL)
      .distinct('object', { projectId, deletedAt: { $in: [null] } })) as string[];
    for (const objectSlug of objects.filter(Boolean)) {
      const r = await ensureRanks(projectId, objectSlug, perObjectLimit);
      if (r.scanned === 0 && r.updated === 0) continue;
      out.push({ objectSlug, scanned: r.scanned, updated: r.updated });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/**
 * Projects that have any live SabCRM records (and therefore may need rank
 * backfill). Used by the scheduler to discover work without a dedicated config
 * collection — ranking is meta, it has no rule docs of its own (mirrors the
 * shape of `listProjectsWithScoring`, but keyed off records).
 */
export async function listProjectsWithRankableRecords(db: Db): Promise<string[]> {
  try {
    const ids = (await db
      .collection(RECORDS_COLL)
      .distinct('projectId', { deletedAt: { $in: [null] } })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}

/** Re-export the pure assignment types alongside the local result shapes. */
export type { RankAssignment as RankKeyAssignment };
export type { Rankable as RankableRecord };
