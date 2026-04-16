'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import { getSession } from '@/app/actions/user.actions';

export type FlowSession = {
  _id: string;
  sessionId: string;
  flowId: string;
  variables: Record<string, string>;
  currentGroupId: string | null;
  currentBlockIndex: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  /** Message count derived from execution history stored inside the doc */
  messageCount?: number;
  /** Last message text captured during execution */
  lastMessage?: string;
};

export type FlowResultsStats = {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  avgMessageCount: number;
};

export type DailyCount = {
  date: string; // "YYYY-MM-DD"
  total: number;
  completed: number;
};

const SESSION_COLLECTION = 'sabflow_sessions';

/** Verify ownership — returns the flow name if the caller owns it. */
async function assertOwnership(flowId: string): Promise<string | null> {
  if (!ObjectId.isValid(flowId)) return null;
  const session = await getSession();
  if (!session?.user) return null;

  const flows = await getSabFlowCollection();
  const flow = await flows.findOne(
    { _id: new ObjectId(flowId), userId: session.user._id.toString() },
    { projection: { name: 1 } },
  );
  return flow ? flow.name : null;
}

// ── getFlowSessions ────────────────────────────────────────────────────────

export async function getFlowSessions(
  flowId: string,
  page = 1,
  pageSize = 20,
): Promise<{ sessions: FlowSession[]; total: number; flowName: string } | { error: string }> {
  const flowName = await assertOwnership(flowId);
  if (!flowName) return { error: 'Flow not found or access denied' };

  try {
    const { db } = await connectToDatabase();
    const col = db.collection(SESSION_COLLECTION);

    const filter = { flowId };
    const total = await col.countDocuments(filter);

    const docs = await col
      .find(filter, { projection: { _flowSnapshot: 0 } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    const sessions: FlowSession[] = docs.map((doc: any) => ({
      _id: doc._id?.toString() ?? doc.sessionId,
      sessionId: doc.sessionId,
      flowId: doc.flowId,
      variables: doc.variables ?? {},
      currentGroupId: doc.currentGroupId ?? null,
      currentBlockIndex: doc.currentBlockIndex ?? 0,
      isCompleted: doc.isCompleted ?? false,
      createdAt: doc.createdAt ?? new Date().toISOString(),
      updatedAt: doc.updatedAt ?? new Date().toISOString(),
      messageCount: doc.messageCount ?? 0,
      lastMessage: doc.lastMessage ?? '',
    }));

    return { sessions, total, flowName };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown error' };
  }
}

// ── getFlowResultsStats ────────────────────────────────────────────────────

export async function getFlowResultsStats(
  flowId: string,
): Promise<FlowResultsStats | { error: string }> {
  const flowName = await assertOwnership(flowId);
  if (!flowName) return { error: 'Flow not found or access denied' };

  try {
    const { db } = await connectToDatabase();
    const col = db.collection(SESSION_COLLECTION);

    const [total, completed, msgAgg] = await Promise.all([
      col.countDocuments({ flowId }),
      col.countDocuments({ flowId, isCompleted: true }),
      col
        .aggregate([
          { $match: { flowId } },
          { $group: { _id: null, avg: { $avg: '$messageCount' } } },
        ])
        .toArray(),
    ]);

    return {
      totalSessions: total,
      completedSessions: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgMessageCount: Math.round((msgAgg[0]?.avg as number) ?? 0),
    };
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown error' };
  }
}

// ── getSessionsPerDay ──────────────────────────────────────────────────────

export async function getSessionsPerDay(
  flowId: string,
  days = 7,
): Promise<DailyCount[] | { error: string }> {
  const flowName = await assertOwnership(flowId);
  if (!flowName) return { error: 'Flow not found or access denied' };

  try {
    const { db } = await connectToDatabase();
    const col = db.collection(SESSION_COLLECTION);

    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const agg = await col
      .aggregate([
        { $match: { flowId, createdAt: { $gte: since.toISOString() } } },
        {
          $group: {
            _id: { $substr: ['$createdAt', 0, 10] },
            total: { $sum: 1 },
            completed: { $sum: { $cond: ['$isCompleted', 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    // Fill in missing days with zeros
    const resultMap = new Map<string, { total: number; completed: number }>();
    for (const item of agg as any[]) {
      resultMap.set(item._id, { total: item.total, completed: item.completed });
    }

    const result: DailyCount[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const entry = resultMap.get(key) ?? { total: 0, completed: 0 };
      result.push({ date: key, ...entry });
    }

    return result;
  } catch (e: any) {
    return { error: e?.message ?? 'Unknown error' };
  }
}
