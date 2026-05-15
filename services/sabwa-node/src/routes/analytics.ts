/**
 * `/v1/analytics` — read-only aggregation surface for the dashboard.
 *
 * Single endpoint:
 *   GET /v1/analytics?sessionId=<id>&range=<7d|30d|all>
 *
 * Returns the shape `SabwaAnalyticsPayload` expects (see
 * `src/app/actions/sabwa.actions.ts`):
 *
 *   {
 *     kpis: { todayIn, todayOut, medianResponseMs, scheduledHitRate, aiCalls, banRiskScore },
 *     messagesByDay:     [{ date, in, out }],
 *     responseTime|responseHistogram: [{ bucket, count }],
 *     topContacts:       [{ jid, name?, count }],
 *     groupHeatmap:      [{ day, hour, count }],
 *     hourlySendPattern: [{ hour, count }],
 *     scheduledHitRate:  number (also surfaced inside `kpis`),
 *     aiUsage|aiUsageByDay: [{ date, suggest, summarise, translate }],
 *   }
 *
 * All series are built with a single set of Mongo `aggregate()` calls against
 * `sabwa_messages` (plus `sabwa_scheduled` for the scheduler hit-rate and
 * `sabwa_contacts` for friendly names). We deliberately keep the route
 * synchronous — these aggregations cost ~tens-of-ms for a single session at
 * 30-day scope and the Next.js dashboard caches the response client-side.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { AppState } from '../state.js';

const Query = z.object({
  sessionId: z.string().min(1),
  range: z.enum(['7d', '30d', '90d', 'all', 'custom']).default('7d'),
  from: z.string().optional(),
  to: z.string().optional(),
});

interface Window {
  from: Date;
  to: Date;
  /** Inclusive UTC-day string YYYY-MM-DD used for grouping. */
  days: string[];
}

/** Build a [from, to] window from the range param + optional explicit bounds. */
function windowFor(range: string, fromStr?: string, toStr?: string): Window {
  const now = new Date();
  const to = toStr ? new Date(toStr) : now;
  let from: Date;
  if (range === 'all') {
    from = new Date(0);
  } else if (range === '30d') {
    from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (range === '90d') {
    from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (range === 'custom' && fromStr) {
    from = new Date(fromStr);
  } else {
    from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  // Pre-compute the day series so we can backfill zeros on the client side
  // — much cheaper than an `$densify` stage in Mongo.
  const days: string[] = [];
  if (range !== 'all') {
    const cursor = new Date(from);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(0, 0, 0, 0);
    while (cursor <= end) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return { from, to, days };
}

export function buildAnalyticsRouter(state: AppState): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const parsed = Query.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: 'bad_request' });
      return;
    }
    const { sessionId, range, from, to } = parsed.data;
    const win = windowFor(range, from, to);

    try {
      const messages = state.db.collection('sabwa_messages');
      const matchSession = { sessionId };
      const matchWindow =
        range === 'all'
          ? matchSession
          : { ...matchSession, ts: { $gte: win.from, $lte: win.to } };

      // 1. messagesByDay — count in vs out per UTC day.
      const dayAgg = await messages
        .aggregate([
          { $match: matchWindow },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } },
                fromMe: '$fromMe',
              },
              n: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const dayMap = new Map<string, { in: number; out: number }>();
      for (const row of dayAgg) {
        const date = row._id.date as string;
        const bucket = dayMap.get(date) ?? { in: 0, out: 0 };
        if (row._id.fromMe) bucket.out += row.n;
        else bucket.in += row.n;
        dayMap.set(date, bucket);
      }
      const messagesByDay = (win.days.length > 0 ? win.days : Array.from(dayMap.keys()).sort()).map(
        (date) => ({ date, in: dayMap.get(date)?.in ?? 0, out: dayMap.get(date)?.out ?? 0 }),
      );

      // 2. responseTime — histogram of "time to my reply" in seconds.
      //    For each inbound message we look up the next outbound message in
      //    the same chat; this is approximate (uses the lag against the
      //    NEXT outbound in the window, not a fully threaded reply graph) but
      //    plenty for the dashboard.
      const respAgg = await messages
        .aggregate([
          { $match: { ...matchWindow, fromMe: false } },
          {
            $lookup: {
              from: 'sabwa_messages',
              let: { chat: '$chatJid', t: '$ts', sid: '$sessionId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$sessionId', '$$sid'] },
                        { $eq: ['$chatJid', '$$chat'] },
                        { $eq: ['$fromMe', true] },
                        { $gt: ['$ts', '$$t'] },
                      ],
                    },
                  },
                },
                { $sort: { ts: 1 } },
                { $limit: 1 },
              ],
              as: 'reply',
            },
          },
          { $unwind: '$reply' },
          {
            $project: {
              gapMs: { $subtract: ['$reply.ts', '$ts'] },
            },
          },
          {
            $bucket: {
              groupBy: '$gapMs',
              boundaries: [0, 30_000, 60_000, 5 * 60_000, 30 * 60_000, 60 * 60_000, 24 * 60 * 60_000, Number.MAX_SAFE_INTEGER],
              default: 'over_24h',
              output: { count: { $sum: 1 }, gaps: { $push: '$gapMs' } },
            },
          },
        ])
        .toArray();

      const labelFor = (lo: number, hi: number): string => {
        if (lo === 0 && hi === 30_000) return '0-30s';
        if (lo === 30_000 && hi === 60_000) return '30-60s';
        if (lo === 60_000 && hi === 5 * 60_000) return '1-5m';
        if (lo === 5 * 60_000 && hi === 30 * 60_000) return '5-30m';
        if (lo === 30 * 60_000 && hi === 60 * 60_000) return '30-60m';
        if (lo === 60 * 60_000 && hi === 24 * 60 * 60_000) return '1-24h';
        return '24h+';
      };
      const boundaries = [0, 30_000, 60_000, 5 * 60_000, 30 * 60_000, 60 * 60_000, 24 * 60 * 60_000];
      const responseHistogram = boundaries.map((lo, i) => {
        const hi = boundaries[i + 1] ?? Number.MAX_SAFE_INTEGER;
        const bucketDoc = respAgg.find((b) => b._id === lo);
        return { bucket: labelFor(lo, hi), count: (bucketDoc?.count as number) ?? 0 };
      });
      const overflow = respAgg.find((b) => b._id === 'over_24h');
      if (overflow) responseHistogram.push({ bucket: '24h+', count: overflow.count as number });

      // Compute median from raw bucket values.
      const allGaps: number[] = respAgg.flatMap((b) => (b.gaps as number[]) ?? []);
      allGaps.sort((a, b) => a - b);
      const medianResponseMs = allGaps.length === 0 ? 0 : allGaps[Math.floor(allGaps.length / 2)] ?? 0;

      // 3. topContacts — most-active inbound jids, max 10.
      const topAgg = await messages
        .aggregate([
          { $match: { ...matchWindow, fromMe: false } },
          { $group: { _id: '$chatJid', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'sabwa_contacts',
              let: { jid: '$_id', sid: sessionId },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$jid', '$$jid'] },
                        { $eq: ['$sessionId', '$$sid'] },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
              as: 'contact',
            },
          },
        ])
        .toArray();
      const topContacts = topAgg.map((r) => ({
        jid: r._id as string,
        name: (r.contact?.[0]?.name as string | undefined) ?? (r.contact?.[0]?.pushName as string | undefined),
        count: r.count as number,
      }));

      // 4. groupHeatmap — day-of-week × hour for group inbound messages.
      const heatAgg = await messages
        .aggregate([
          { $match: { ...matchWindow, chatJid: { $regex: '@g\\.us$' } } },
          {
            $group: {
              _id: {
                day: { $dayOfWeek: '$ts' }, // 1=Sun..7=Sat in Mongo
                hour: { $hour: '$ts' },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();
      const groupHeatmap = heatAgg.map((r) => ({
        // Convert Mongo's 1-7 day index to our 0-6 (Sun=0..Sat=6).
        day: ((r._id.day as number) - 1) % 7,
        hour: r._id.hour as number,
        count: r.count as number,
      }));

      // 5. hourlySendPattern — distribution of MY (outbound) hours.
      const hourAgg = await messages
        .aggregate([
          { $match: { ...matchWindow, fromMe: true } },
          { $group: { _id: { $hour: '$ts' }, count: { $sum: 1 } } },
        ])
        .toArray();
      const hourMap = new Map<number, number>(hourAgg.map((r) => [r._id as number, r.count as number]));
      const hourlySendPattern = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: hourMap.get(h) ?? 0,
      }));

      // 6. scheduledHitRate — count(sent) / count(total) over the window.
      const scheduledCol = state.db.collection('sabwa_scheduled');
      const schedMatch =
        range === 'all'
          ? { sessionId }
          : { sessionId, scheduledFor: { $gte: win.from, $lte: win.to } };
      const [totalSched, sentSched] = await Promise.all([
        scheduledCol.countDocuments(schedMatch),
        scheduledCol.countDocuments({ ...schedMatch, status: 'sent' }),
      ]);
      const scheduledHitRate = totalSched === 0 ? 0 : sentSched / totalSched;

      // 7. aiUsage — placeholder series, mirrors the wire shape so the chart
      //    keeps rendering. Real AI accounting lives in a separate agent.
      const aiUsageByDay = (win.days.length > 0 ? win.days : Array.from(dayMap.keys()).sort()).map(
        (date) => ({ date, suggest: 0, summarise: 0, translate: 0 }),
      );

      // 8. KPIs — today's in/out, etc.
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayAgg = await messages
        .aggregate([
          { $match: { sessionId, ts: { $gte: todayStart } } },
          { $group: { _id: '$fromMe', n: { $sum: 1 } } },
        ])
        .toArray();
      const todayIn = (todayAgg.find((r) => r._id === false)?.n as number) ?? 0;
      const todayOut = (todayAgg.find((r) => r._id === true)?.n as number) ?? 0;

      // Ban-risk surface from the session doc (best-effort — many installs
      // store it as `banRiskScore`; we fall back to 0 if missing).
      const sessionDoc = await state.db
        .collection('sabwa_sessions')
        .findOne({}, { projection: { banRiskScore: 1 } });
      const banRiskScore = (sessionDoc?.banRiskScore as number | undefined) ?? 0;

      res.json({
        kpis: {
          todayIn,
          todayOut,
          medianResponseMs,
          scheduledHitRate,
          aiCalls: 0,
          banRiskScore,
        },
        messagesByDay,
        responseTime: responseHistogram, // requested key (alias of histogram)
        responseHistogram,
        topContacts,
        groupHeatmap,
        hourlySendPattern,
        scheduledHitRate,
        aiUsage: aiUsageByDay,
        aiUsageByDay,
      });
    } catch (err) {
      state.log.error({ err, sessionId }, 'analytics.aggregate failed');
      res.status(500).json({ error: 'analytics.aggregate failed', code: 'internal' });
    }
  });

  return router;
}
