/**
 * `GET /metrics` — basic JSON metrics for ops dashboards.
 *
 * Service-token gated (mounted behind `requireServiceToken`). Returns a
 * point-in-time snapshot — no time-series — keyed for human/admin consumption,
 * not Prometheus. A Prom adapter can sit in front later if needed.
 *
 * Response shape:
 * ```
 * {
 *   ts: string,                                 // ISO snapshot timestamp
 *   sessions: {
 *     total: number,
 *     byStatus: Record<string, number>,
 *   },
 *   messages: {
 *     today: number,                            // total messages in sabwa_messages today (UTC)
 *     perSession: Array<{ sessionId, count }>,  // today, top 50
 *   },
 *   errors: {
 *     today: number,                            // sabwa_audit_log entries today with level=error
 *   },
 * }
 * ```
 */

import { Router, type Request, type Response } from 'express';
import type { AppState } from '../state.js';

/** Start of today (UTC) — Mongo's `createdAt` is stored as UTC Date. */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

interface SessionStatusCount {
  [status: string]: number;
}

interface PerSessionCount {
  sessionId: string;
  count: number;
}

export function buildMetricsRouter(state: AppState): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    const since = startOfTodayUtc();

    const byStatus: SessionStatusCount = {};
    for (const s of state.sessions.values()) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    }

    const messagesColl = state.db.collection('sabwa_messages');
    const auditColl = state.db.collection('sabwa_audit_log');

    // Run Mongo queries in parallel; tolerate individual failures so /metrics
    // is best-effort and doesn't 500 if a single aggregation hiccups.
    const [messagesTodayRes, perSessionRes, errorsTodayRes] = await Promise.allSettled([
      messagesColl.countDocuments({ createdAt: { $gte: since } }),
      messagesColl
        .aggregate<{ _id: unknown; count: number }>([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$sessionId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 50 },
        ])
        .toArray(),
      auditColl.countDocuments({
        createdAt: { $gte: since },
        level: 'error',
      }),
    ]);

    const messagesToday = messagesTodayRes.status === 'fulfilled' ? messagesTodayRes.value : 0;
    const errorsToday = errorsTodayRes.status === 'fulfilled' ? errorsTodayRes.value : 0;
    const perSession: PerSessionCount[] =
      perSessionRes.status === 'fulfilled'
        ? perSessionRes.value.map((row) => ({
            sessionId: row._id == null ? 'unknown' : String(row._id),
            count: row.count,
          }))
        : [];

    res.json({
      ts: new Date().toISOString(),
      sessions: {
        total: state.sessions.size,
        byStatus,
      },
      messages: {
        today: messagesToday,
        perSession,
      },
      errors: {
        today: errorsToday,
      },
    });
  });

  return router;
}
