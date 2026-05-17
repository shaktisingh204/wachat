/**
 * GET /api/v1/flows/[flowId]/executions?limit=20&status=success
 *
 * Lists recent executions of a flow.  Auth: API-key.  Sorted newest-first.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/lib/sabflow/apiKeys/auth';
import { getExecutionHistory, getSabFlowById } from '@/lib/sabflow/db';
import type { ExecutionStatus, ExecutionTriggerMode } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_STATUS = new Set<ExecutionStatus>([
  'running',
  'success',
  'error',
  'cancelled',
]);
const VALID_TRIGGER = new Set<ExecutionTriggerMode>([
  'manual',
  'schedule',
  'webhook',
  'start',
  'test',
]);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ flowId: string }> },
) {
  const auth = await authenticateApiRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { flowId } = await ctx.params;
  const flow = await getSabFlowById(flowId);
  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }
  if (flow.userId !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 20), 1), 100);
  const skip = Math.max(Number(searchParams.get('skip') ?? 0), 0);

  const statusParam = searchParams.get('status');
  const triggerParam = searchParams.get('triggerMode');
  const status =
    statusParam && VALID_STATUS.has(statusParam as ExecutionStatus)
      ? (statusParam as ExecutionStatus)
      : undefined;
  const triggerMode =
    triggerParam && VALID_TRIGGER.has(triggerParam as ExecutionTriggerMode)
      ? (triggerParam as ExecutionTriggerMode)
      : undefined;

  try {
    const { executions, total } = await getExecutionHistory(flowId, limit, skip, {
      status,
      triggerMode,
    });
    return NextResponse.json({
      total,
      limit,
      skip,
      executions: executions.map((e) => ({
        id: e.id,
        status: e.status,
        triggerMode: e.triggerMode,
        startedAt: e.startedAt,
        finishedAt: e.finishedAt,
        executionTimeMs: e.executionTimeMs,
        nodeCount: e.nodeCount,
        error: e.error,
      })),
    });
  } catch (err) {
    console.error('[SABFLOW V1 EXECUTIONS LIST] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
