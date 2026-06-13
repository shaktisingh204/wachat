import 'server-only';

/**
 * SabCRM — frozen forecast snapshots (server-only).
 *
 * Freezes a per-(project,object) point-in-time win/lost/open rollup into
 * `sabcrm_forecast_snapshots` so commit-vs-actual trend can be charted over
 * time. Computed DIRECTLY from `sabcrm_records` (no session, no pipeline
 * dependency) using the same won/lost/open stage heuristic as the predictive
 * scorer, so it runs from a cron with a system token. Idempotent per
 * (projectId, object, snapshotDate). Best-effort; never throws.
 *
 * NOTE: the snapshot is intentionally pipeline-agnostic (heuristic outcome),
 * not the full weighted forecast (which is gated + pipeline-bound). It only
 * writes a row when the object actually has won/lost deals, so non-deal objects
 * are skipped automatically.
 */

import { type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

const RECORDS_COLL = 'sabcrm_records';
const SNAPSHOTS_COLL = 'sabcrm_forecast_snapshots';
const MAX_PAIRS = 500;

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.amountMicros === 'number') return o.amountMicros / 1_000_000;
    if (typeof o.amount === 'number') return o.amount;
  }
  return 0;
}

function outcome(data: Record<string, unknown>): 'won' | 'lost' | 'open' {
  const s = String(data.stage ?? data.status ?? '').toLowerCase();
  if (!s) return 'open';
  if (/\bwon\b|customer|closed.?won|complete/.test(s)) return 'won';
  if (/\blost\b|closed.?lost|cancel|reject|dead/.test(s)) return 'lost';
  return 'open';
}

/** ISO day (UTC) — the snapshot key. */
function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface ForecastSnapshot {
  wonCount: number;
  lostCount: number;
  openCount: number;
  wonAmount: number;
  openAmount: number;
}

/**
 * Compute + freeze one (project, object) snapshot for today. Returns the totals
 * (or null when the object has no won/lost deals → nothing written).
 */
export async function snapshotForObject(
  projectId: string,
  objectSlug: string,
  nowMs: number,
): Promise<ForecastSnapshot | null> {
  try {
    if (!projectId || !objectSlug) return null;
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object: objectSlug, deletedAt: { $in: [null] } })
      .project({ 'data.stage': 1, 'data.status': 1, 'data.amount': 1 })
      .limit(20_000)
      .toArray()) as Array<{ data?: Record<string, unknown> }>;

    const snap: ForecastSnapshot = {
      wonCount: 0,
      lostCount: 0,
      openCount: 0,
      wonAmount: 0,
      openAmount: 0,
    };
    for (const r of recs) {
      const data = r.data ?? {};
      const out = outcome(data);
      const amt = num(data.amount);
      if (out === 'won') {
        snap.wonCount += 1;
        snap.wonAmount += amt;
      } else if (out === 'lost') {
        snap.lostCount += 1;
      } else {
        snap.openCount += 1;
        snap.openAmount += amt;
      }
    }
    // Only deal-like objects (with real outcomes) get a snapshot.
    if (snap.wonCount + snap.lostCount === 0) return null;

    const snapshotDate = isoDay(nowMs);
    await db.collection(SNAPSHOTS_COLL).updateOne(
      { projectId, object: objectSlug, snapshotDate },
      {
        $set: { ...snap, projectId, object: objectSlug, snapshotDate, updatedAt: new Date(nowMs).toISOString() },
        $setOnInsert: { createdAt: new Date(nowMs).toISOString() },
      },
      { upsert: true },
    );
    return snap;
  } catch {
    return null;
  }
}

/**
 * Snapshot every (project, object) pair that has records. Discovers pairs via
 * a single `$group`, capped. Returns the number of snapshots written.
 */
export async function snapshotAllForecasts(
  nowMs: number,
): Promise<{ pairs: number; written: number }> {
  try {
    const { db } = await connectToDatabase();
    const pairs = (await db
      .collection(RECORDS_COLL)
      .aggregate([
        { $match: { deletedAt: { $in: [null] } } },
        { $group: { _id: { projectId: '$projectId', object: '$object' } } },
        { $limit: MAX_PAIRS },
      ])
      .toArray()) as Array<{ _id: { projectId?: string; object?: string } }>;
    let written = 0;
    for (const p of pairs) {
      const projectId = p._id.projectId;
      const object = p._id.object;
      if (!projectId || !object) continue;
      const res = await snapshotForObject(projectId, object, nowMs);
      if (res) written += 1;
    }
    return { pairs: pairs.length, written };
  } catch {
    return { pairs: 0, written: 0 };
  }
}

/** Read a (project, object) snapshot trend (newest first) for charting. */
export async function listForecastSnapshots(
  projectId: string,
  objectSlug: string,
  limit = 90,
): Promise<Array<ForecastSnapshot & { snapshotDate: string }>> {
  try {
    if (!projectId || !objectSlug) return [];
    const { db } = await connectToDatabase();
    const rows = (await db
      .collection(SNAPSHOTS_COLL)
      .find({ projectId, object: objectSlug })
      .sort({ snapshotDate: -1 })
      .limit(limit)
      .toArray()) as unknown as Array<ForecastSnapshot & { snapshotDate: string }>;
    return rows;
  } catch {
    return [];
  }
}

/** Ensure the snapshot uniqueness index (best-effort). */
export async function ensureSnapshotIndex(db: Db): Promise<void> {
  try {
    await db
      .collection(SNAPSHOTS_COLL)
      .createIndex({ projectId: 1, object: 1, snapshotDate: 1 }, { unique: true });
  } catch {
    /* best-effort */
  }
}
