/**
 * GET /api/sabflow/usage?days=7
 *
 * Aggregates execution stats for the caller's workspace:
 *   - total runs
 *   - success / error / running / cancelled counts
 *   - average + p95 duration
 *   - daily run buckets (for a small sparkline)
 *   - top 10 flows by execution count
 *   - top 5 failing flows (by error count)
 *
 * Pure Mongo aggregation pipeline — no app-level looping over rows.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getUsageSummary } from '@/app/actions/developer-platform.actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = (session.user as { _id: { toString(): string } })._id.toString();

  const { searchParams } = new URL(req.url);
  const daysRaw = Number(searchParams.get('days') ?? 7);
  const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 7, 1), 90);

  const now = Date.now();
  const since = new Date(now - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(now - 2 * days * 24 * 60 * 60 * 1000);

  try {
    const { db } = await connectToDatabase();

    // First resolve the caller's flow ids — executions are joined by flowId.
    const flowDocs = await db
      .collection('sabflows')
      .find({ userId }, { projection: { _id: 1, name: 1 } })
      .toArray();
    const flowById = new Map<string, string>(
      flowDocs.map((d) => [d._id.toString(), (d.name as string) ?? '(unnamed)']),
    );
    const flowIds = Array.from(flowById.keys());

    if (flowIds.length === 0) {
      return NextResponse.json(emptyResponse(days));
    }

    const execsCol = db.collection('sabflow_executions');

    // ── Summary counts + duration stats
    const summaryAgg = await execsCol
      .aggregate([
        { $match: { flowId: { $in: flowIds }, startedAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            success: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
            },
            errored: {
              $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
            },
            running: {
              $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            steps: {
              $sum: {
                $size: { $objectToArray: { $ifNull: ['$nodeStates', {}] } }
              }
            },
            avgDuration: { $avg: '$executionTimeMs' },
            durations: { $push: '$executionTimeMs' },
          },
        },
      ])
      .toArray();
    const summary = summaryAgg[0] ?? {
      total: 0,
      success: 0,
      errored: 0,
      running: 0,
      cancelled: 0,
      avgDuration: 0,
      durations: [],
    };

    const durations = (summary.durations ?? [])
      .filter((d: unknown) => typeof d === 'number' && d > 0)
      .sort((a: number, b: number) => a - b);
    const p95 = durations.length
      ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
      : 0;

    // ── Previous period stats for trends
    const prevSummaryAgg = await execsCol
      .aggregate([
        { $match: { flowId: { $in: flowIds }, startedAt: { $gte: prevSince, $lt: since } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            success: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
            },
            errored: {
              $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
            },
            steps: {
              $sum: {
                $size: { $objectToArray: { $ifNull: ['$nodeStates', {}] } }
              }
            },
            durations: { $push: '$executionTimeMs' },
          },
        },
      ])
      .toArray();

    const prevSummary = prevSummaryAgg[0] ?? { total: 0, success: 0, errored: 0, durations: [] };
    const prevDurations = (prevSummary.durations ?? [])
      .filter((d: unknown) => typeof d === 'number' && d > 0)
      .sort((a: number, b: number) => a - b);
    const prevP95 = prevDurations.length
      ? prevDurations[Math.min(prevDurations.length - 1, Math.floor(prevDurations.length * 0.95))]
      : 0;
    const prevSuccessRate = prevSummary.total > 0 ? prevSummary.success / prevSummary.total : 0;
    const successRate = summary.total > 0 ? summary.success / summary.total : 0;

    // ── Global API Usage
    const apiUsageRes = await getUsageSummary({
      from: since.toISOString(),
    });
    const apiUsagePrevRes = await getUsageSummary({
      from: prevSince.toISOString(),
      to: since.toISOString(),
    });

    const apiUsage = apiUsageRes.success ? apiUsageRes.totalRequests : 0;
    const apiUsagePrev = apiUsagePrevRes.success ? apiUsagePrevRes.totalRequests : 0;

    // Calculate trends (percentage change)
    const trends = {
      total: calculateTrend(prevSummary.total, summary.total),
      successRate: calculateTrend(prevSuccessRate * 100, successRate * 100),
      errored: calculateTrend(prevSummary.errored, summary.errored),
      p95DurationMs: calculateTrend(prevP95, p95),
      steps: calculateTrend(prevSummary.steps ?? 0, summary.steps ?? 0),
      apiUsage: calculateTrend(apiUsagePrev, apiUsage),
    };

    // ── Daily buckets
    const dailyAgg = await execsCol
      .aggregate([
        { $match: { flowId: { $in: flowIds }, startedAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$startedAt' },
            },
            count: { $sum: 1 },
            errors: {
              $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
            },
            steps: {
              $sum: {
                $size: { $objectToArray: { $ifNull: ['$nodeStates', {}] } }
              }
            }
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    // ── Top flows by run count
    const topByRuns = await execsCol
      .aggregate([
        { $match: { flowId: { $in: flowIds }, startedAt: { $gte: since } } },
        { $group: { _id: '$flowId', runs: { $sum: 1 } } },
        { $sort: { runs: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // ── Top failing flows
    const topFailing = await execsCol
      .aggregate([
        {
          $match: {
            flowId: { $in: flowIds },
            startedAt: { $gte: since },
            status: 'error',
          },
        },
        { $group: { _id: '$flowId', errors: { $sum: 1 } } },
        { $sort: { errors: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    return NextResponse.json({
      windowDays: days,
      since: since.toISOString(),
      summary: {
        total: summary.total,
        success: summary.success,
        errored: summary.errored,
        running: summary.running,
        cancelled: summary.cancelled,
        steps: summary.steps ?? 0,
        apiUsage,
        successRate,
        avgDurationMs: Math.round(summary.avgDuration ?? 0),
        p95DurationMs: Math.round(p95),
        trends,
      },
      daily: dailyAgg.map((d) => ({
        date: d._id,
        count: d.count,
        errors: d.errors,
        steps: d.steps ?? 0,
      })),
      topFlows: topByRuns.map((t) => ({
        flowId: t._id,
        name: flowById.get(t._id) ?? '(unknown)',
        runs: t.runs,
      })),
      topFailing: topFailing.map((t) => ({
        flowId: t._id,
        name: flowById.get(t._id) ?? '(unknown)',
        errors: t.errors,
      })),
    });
  } catch (err) {
    console.error('[SABFLOW USAGE] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function emptyResponse(days: number) {
  return {
    windowDays: days,
    since: new Date(Date.now() - days * 86_400_000).toISOString(),
    summary: {
      total: 0,
      success: 0,
      errored: 0,
      running: 0,
      cancelled: 0,
      steps: 0,
      apiUsage: 0,
      successRate: 0,
      avgDurationMs: 0,
      p95DurationMs: 0,
      trends: {
        total: 0,
        successRate: 0,
        errored: 0,
        p95DurationMs: 0,
        steps: 0,
        apiUsage: 0,
      },
    },
    daily: [],
    topFlows: [],
    topFailing: [],
  };
}

function calculateTrend(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/** Silence the unused-import lint when this file is examined in isolation. */
void ObjectId;
