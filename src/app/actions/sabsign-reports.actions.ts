'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getSabsignWorkspaceId } from '@/lib/sabsign/workspace';

/* SabSign analytics — aggregates over the workspace's `esign_envelopes`. */

export interface SabsignReportStats {
  total: number;
  byStatus: Record<string, number>;
  completionRate: number; // percent
  avgHoursToComplete: number | null;
  recent: Array<{ name: string; status: string; createdAt?: string; signers: number }>;
}

const EMPTY: SabsignReportStats = {
  total: 0,
  byStatus: {},
  completionRate: 0,
  avgHoursToComplete: null,
  recent: [],
};

export async function getSabsignReportStats(): Promise<SabsignReportStats> {
  const session = await getSession();
  if (!session?.user?._id) return EMPTY;
  const ws = await getSabsignWorkspaceId();
  if (!ws) return EMPTY;

  const { db } = await connectToDatabase();
  const all = await db
    .collection('esign_envelopes')
    .find(
      { tenantId: ws },
      { projection: { name: 1, status: 1, createdAt: 1, completedAt: 1, signers: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(5000)
    .toArray();

  const byStatus: Record<string, number> = {};
  for (const e of all) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;

  const completed = all.filter(
    (e) => e.status === 'completed' && e.completedAt && e.createdAt,
  );
  const completionRate = all.length
    ? Math.round(((byStatus.completed ?? 0) / all.length) * 100)
    : 0;
  const avgHours = completed.length
    ? completed.reduce(
        (sum, e) =>
          sum + (Date.parse(e.completedAt) - Date.parse(e.createdAt)) / 3_600_000,
        0,
      ) / completed.length
    : null;

  return {
    total: all.length,
    byStatus,
    completionRate,
    avgHoursToComplete: avgHours != null ? Math.round(avgHours * 10) / 10 : null,
    recent: all.slice(0, 12).map((e) => ({
      name: e.name,
      status: e.status,
      createdAt: e.createdAt,
      signers: Array.isArray(e.signers) ? e.signers.length : 0,
    })),
  };
}
