/**
 * GET /api/sabflow/[flowId]/analytics
 *
 * Returns aggregate analytics for the given flow's submissions.
 *
 * Response shape:
 * {
 *   totalSessions:          number
 *   completionRate:         number           (0–100, percent)
 *   averageCompletionTime:  number | null    (seconds; null if no completed pair)
 *   dropOffByBlock:         { blockId: string; blockLabel: string; dropOffCount: number }[]
 *   submissionsOverTime:    { date: string; count: number }[]   ("YYYY-MM-DD", last 30 days)
 * }
 *
 * Auth: session cookie ownership check.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

const SUBMISSIONS_COLLECTION = 'sabflow_submissions';
const SESSIONS_COLLECTION = 'sabflow_sessions';

/* ── ownership guard ──────────────────────────────────────── */

async function assertOwnsFlow(flowId: string): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;
  if (!ObjectId.isValid(flowId)) return false;

  const flows = await getSabFlowCollection();
  const flow = await flows.findOne(
    { _id: new ObjectId(flowId), userId: session.user._id.toString() },
    { projection: { _id: 1 } },
  );
  return flow !== null;
}

/* ── GET ──────────────────────────────────────────────────── */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;

  const owns = await assertOwnsFlow(flowId);
  if (!owns) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
  }

  try {
    const { db } = await connectToDatabase();
    const submissionsCol = db.collection(SUBMISSIONS_COLLECTION);
    const sessionsCol = db.collection(SESSIONS_COLLECTION);

    // ── Date range: last 30 days ──────────────────────────
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    // ── Run all aggregations in parallel ─────────────────
    const [
      totalSessions,
      completedCount,
      completionTimeAgg,
      submissionsOverTimeAgg,
      dropOffAgg,
    ] = await Promise.all([
      // 1. Total sessions started (from sessions collection)
      sessionsCol.countDocuments({ flowId }),

      // 2. Completed submissions count
      submissionsCol.countDocuments({ flowId }),

      // 3. Average completion time: completedAt - startedAt in seconds
      submissionsCol
        .aggregate([
          {
            $match: {
              flowId,
              startedAt: { $exists: true, $ne: null },
              completedAt: { $exists: true, $ne: null },
            },
          },
          {
            $addFields: {
              startedMs: {
                $cond: [
                  { $eq: [{ $type: '$startedAt' }, 'date'] },
                  { $toLong: '$startedAt' },
                  { $toLong: { $dateFromString: { dateString: '$startedAt' } } },
                ],
              },
              completedMs: {
                $cond: [
                  { $eq: [{ $type: '$completedAt' }, 'date'] },
                  { $toLong: '$completedAt' },
                  { $toLong: { $dateFromString: { dateString: '$completedAt' } } },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgMs: {
                $avg: { $subtract: ['$completedMs', '$startedMs'] },
              },
            },
          },
        ])
        .toArray(),

      // 4. Submissions over time — last 30 days
      submissionsCol
        .aggregate([
          {
            $match: {
              flowId,
              $or: [
                { completedAt: { $gte: since } },
                { completedAt: { $gte: sinceIso } },
              ],
            },
          },
          {
            $addFields: {
              dateStr: {
                $cond: [
                  { $eq: [{ $type: '$completedAt' }, 'date'] },
                  { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
                  { $substr: ['$completedAt', 0, 10] },
                ],
              },
            },
          },
          {
            $group: {
              _id: '$dateStr',
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),

      // 5. Drop-off: sessions that are NOT completed, grouped by last known block
      //    We read from sessions collection where isCompleted=false.
      sessionsCol
        .aggregate([
          { $match: { flowId, isCompleted: false } },
          {
            $group: {
              _id: {
                groupId: '$currentGroupId',
                blockIndex: '$currentBlockIndex',
              },
              dropOffCount: { $sum: 1 },
            },
          },
          { $sort: { dropOffCount: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
    ]);

    // ── Derive completionRate ─────────────────────────────
    const completionRate =
      totalSessions > 0
        ? Math.round((completedCount / totalSessions) * 100)
        : 0;

    // ── Average completion time in seconds ────────────────
    const avgMs = (completionTimeAgg[0] as { avgMs?: number } | undefined)?.avgMs;
    const averageCompletionTime =
      avgMs != null && Number.isFinite(avgMs)
        ? Math.round(avgMs / 1000)
        : null;

    // ── Submissions over time — fill missing days with 0 ──
    const countMap = new Map<string, number>();
    for (const item of submissionsOverTimeAgg as { _id: string; count: number }[]) {
      countMap.set(item._id, item.count);
    }
    const submissionsOverTime: { date: string; count: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      submissionsOverTime.push({ date: key, count: countMap.get(key) ?? 0 });
    }

    // ── Drop-off by block ─────────────────────────────────
    const dropOffByBlock = (
      dropOffAgg as {
        _id: { groupId: string | null; blockIndex: number };
        dropOffCount: number;
      }[]
    ).map((item) => ({
      blockId: item._id.groupId ?? 'unknown',
      blockLabel: item._id.groupId
        ? `Group ${item._id.groupId.slice(0, 8)} · step ${item._id.blockIndex + 1}`
        : 'Start',
      dropOffCount: item.dropOffCount,
    }));

    return NextResponse.json({
      totalSessions,
      completionRate,
      averageCompletionTime,
      dropOffByBlock,
      submissionsOverTime,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[SABFLOW ANALYTICS] GET error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
