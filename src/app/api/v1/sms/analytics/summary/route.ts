import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { apiError, withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import {
  queryDailyStats,
  seriesFromRows,
  sumCounters,
} from '@/lib/sabsms/analytics/rollups';

/**
 * Public API — `GET /api/v1/sms/analytics/summary?from&to`.
 *
 * Reads the precomputed `sabsms_stats_daily` rollups (never the raw
 * message collection) and returns totals + a dense per-day series for
 * the inclusive UTC date range. Defaults to the last 30 days.
 *
 * NOTE (V2.13 honest gap): an RCS→SMS *fallback rate* is intentionally
 * NOT returned here. The `rcsFallback` signal lives only on individual
 * message docs (`SabsmsMessage.rcsFallback`); the daily rollups carry a
 * `channel` dim but no `channelRequested`/fallback counter, and
 * `queryDailyStats` only exposes the `total | provider | campaignId`
 * dims — so a fallback rate cannot be derived from the rollups without a
 * new rollup counter (engine-side, out of this surface's scope). Rather
 * than fabricate a number, the metric is left for a future rollup field.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoUtc(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const GET = withSabsmsApi('analytics:read', async (req: NextRequest, { auth }) => {
  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? daysAgoUtc(30);
  const to = url.searchParams.get('to') ?? todayUtc();

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return apiError('validation_failed', 'from/to must be YYYY-MM-DD', 422);
  }
  if (from > to) {
    return apiError('validation_failed', 'from must be on or before to', 422);
  }
  const spanDays =
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
      86_400_000 +
    1;
  if (spanDays > MAX_RANGE_DAYS) {
    return apiError('validation_failed', `range too large (max ${MAX_RANGE_DAYS} days)`, 422);
  }

  const { db } = await connectToDatabase();
  const rows = await queryDailyStats(db, {
    workspaceId: auth.workspaceId,
    fromDate: from,
    toDate: to,
    dim: 'total',
  });

  const totals = sumCounters(rows);
  const days = seriesFromRows(rows, from, to).map(({ date, ...counters }) => ({
    date,
    counters,
  }));

  return NextResponse.json({ from, to, totals, days });
});
