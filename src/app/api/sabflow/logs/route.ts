/**
 * SabFlow — system logs feed.
 *
 *   GET /api/sabflow/logs?limit=200
 *     → { logs: LogLine[] }
 *
 * Log lines are derived from the user's execution history: one line per
 * execution outcome plus one line per recorded node step (when the run was
 * persisted verbosely). Newest first.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { ExecutionHistoryNode } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LogSeverity = 'info' | 'warning' | 'error' | 'debug' | 'critical';

type LogLine = {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  node: string;
  message: string;
  metadata: Record<string, string>;
};

function nodeSeverity(status: ExecutionHistoryNode['status']): LogSeverity {
  if (status === 'error') return 'error';
  if (status === 'cancelled') return 'warning';
  if (status === 'skipped' || status === 'waiting') return 'debug';
  return 'info';
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const projectId =
    (session.user as { _id?: { toString(): string }; id?: string })._id?.toString()
    ?? (session.user as { id?: string }).id
    ?? '';

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500);

  try {
    const { db } = await connectToDatabase();

    const executions = await db
      .collection('sabflow_executions')
      .find({ projectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const flowIds = [...new Set(executions.map((e) => String(e.flowId ?? '')))].filter(Boolean);
    const flowNames = new Map<string, string>();
    if (flowIds.length > 0) {
      const { ObjectId } = await import('mongodb');
      const objectIds = flowIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
      const flows = await db
        .collection('sabflows')
        .find({ _id: { $in: objectIds } }, { projection: { name: 1 } })
        .toArray();
      for (const f of flows) flowNames.set(f._id.toHexString(), String(f.name ?? 'Untitled flow'));
    }

    const logs: LogLine[] = [];
    for (const e of executions) {
      const id = e._id.toHexString();
      const flowName = flowNames.get(String(e.flowId)) ?? 'Unknown flow';
      const startedAt: Date = e.startedAt ?? e.createdAt ?? new Date(0);
      const finishedAt: Date | undefined = e.finishedAt ?? undefined;
      const status: string = e.status ?? 'running';

      const execSeverity: LogSeverity =
        status === 'error' ? 'error' : status === 'cancelled' ? 'warning' : 'info';
      const execMessage =
        status === 'error'
          ? String(e.error ?? 'Execution failed')
          : status === 'cancelled'
            ? 'Execution cancelled'
            : status === 'running'
              ? 'Execution started'
              : 'Execution completed';

      logs.push({
        id: `exec-${id}`,
        timestamp: (finishedAt ?? startedAt).toISOString(),
        severity: execSeverity,
        node: flowName,
        message: execMessage,
        metadata: {
          execution: id,
          trigger: String(e.triggerMode ?? 'manual'),
          ...(typeof e.executionTimeMs === 'number'
            ? { duration: `${e.executionTimeMs}ms` }
            : {}),
        },
      });

      const nodes = (e.nodes ?? []) as ExecutionHistoryNode[];
      nodes.forEach((n, idx) => {
        const ts = n.finishedAt ?? n.startedAt ?? startedAt;
        logs.push({
          id: `exec-${id}-node-${idx}`,
          timestamp: new Date(ts).toISOString(),
          severity: nodeSeverity(n.status),
          node: n.blockType || 'block',
          message:
            n.status === 'error'
              ? String(n.error ?? `${n.blockType} failed`)
              : `${n.blockType} ${n.status}${typeof n.durationMs === 'number' ? ` in ${n.durationMs}ms` : ''}`,
          metadata: {
            flow: flowName,
            execution: id,
            block: n.blockId,
          },
        });
      });
    }

    logs.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    return NextResponse.json({ logs: logs.slice(0, limit) });
  } catch (err) {
    console.error('[SABFLOW LOGS]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
