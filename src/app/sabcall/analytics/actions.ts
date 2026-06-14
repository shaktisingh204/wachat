'use server';

/**
 * SabCall analytics — aggregates the call log / CDRs for the active project.
 *
 * Direct Mongo (matches `sabcall.actions.ts`): scoped by the SabCall
 * `workspaceId` stored in each CDR's `userId` field. We pull the window's
 * rows in one `.find(...).toArray()` and reduce in JS — the volume is bounded
 * (one project, last N days) and a single pass keeps the totals, direction /
 * status counts, and the zero-filled per-day series consistent.
 */

import { connectToDatabase } from '@/lib/mongodb';
import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';
import { SABCALL_COLLECTIONS } from '@/lib/sabcall/collections';
import { getErrorMessage } from '@/lib/utils';

export interface CallAnalytics {
  total: number;
  inbound: number;
  outbound: number;
  completed: number;
  missed: number;
  answerRate: number;
  avgDurationSecs: number;
  byDay: { date: string; count: number }[];
}

/** Local `YYYY-MM-DD` key for a date (matches how the window is bucketed). */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getCallAnalytics(
  days = 14,
): Promise<{ ok: true; data: CallAnalytics } | { ok: false; error: string }> {
  try {
    const workspaceId = await getSabcallWorkspaceId();
    if (!workspaceId) return { ok: false as const, error: 'No SabCall project selected.' };

    const window = Math.max(1, Math.floor(days));

    // Inclusive window of `window` calendar days ending today (local).
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (window - 1));

    const { db } = await connectToDatabase();
    const rows = await db
      .collection(SABCALL_COLLECTIONS.calls)
      .find({ userId: workspaceId, startedAt: { $gte: start } })
      .toArray();

    // Zero-filled per-day buckets for the full window (oldest → newest).
    const byDayMap = new Map<string, number>();
    for (let i = 0; i < window; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      byDayMap.set(dayKey(d), 0);
    }

    const acc = rows.reduce(
      (a, r) => {
        a.total += 1;
        if (r.direction === 'inbound') a.inbound += 1;
        else if (r.direction === 'outbound') a.outbound += 1;
        if (r.status === 'completed') a.completed += 1;
        else if (r.status === 'missed') a.missed += 1;
        a.durationSum += typeof r.durationSecs === 'number' ? r.durationSecs : 0;

        const started = r.startedAt instanceof Date ? r.startedAt : new Date(r.startedAt);
        if (!Number.isNaN(started.getTime())) {
          const key = dayKey(started);
          if (byDayMap.has(key)) byDayMap.set(key, (byDayMap.get(key) ?? 0) + 1);
        }
        return a;
      },
      { total: 0, inbound: 0, outbound: 0, completed: 0, missed: 0, durationSum: 0 },
    );

    const data: CallAnalytics = {
      total: acc.total,
      inbound: acc.inbound,
      outbound: acc.outbound,
      completed: acc.completed,
      missed: acc.missed,
      answerRate: acc.total > 0 ? acc.completed / acc.total : 0,
      avgDurationSecs: acc.total > 0 ? Math.round(acc.durationSum / acc.total) : 0,
      byDay: Array.from(byDayMap, ([date, count]) => ({ date, count })),
    };

    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}
