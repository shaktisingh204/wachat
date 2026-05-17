/**
 * GET /api/v1/executions/[executionId]
 *
 * Fetch a single execution by id (status + per-node detail when available).
 * Auth: API-key.  Returns 404 when the execution doesn't belong to the
 * caller's workspace.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/lib/sabflow/apiKeys/auth';
import { getExecutionById, getSabFlowById } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ executionId: string }> },
) {
  const auth = await authenticateApiRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { executionId } = await ctx.params;

  try {
    const execution = await getExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    /* Authorise: the execution's flow must belong to the caller. */
    const flow = await getSabFlowById(execution.flowId);
    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    if (flow.userId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      execution: {
        id: execution.id,
        flowId: execution.flowId,
        status: execution.status,
        triggerMode: execution.triggerMode,
        startedAt: execution.startedAt,
        finishedAt: execution.finishedAt,
        executionTimeMs: execution.executionTimeMs,
        nodeCount: execution.nodeCount,
        variables: execution.variables,
        nodes: execution.nodes ?? [],
        error: execution.error,
      },
    });
  } catch (err) {
    console.error(
      `[SABFLOW V1 EXECUTION GET] error execution=${executionId} user=${auth.userId}:`,
      err,
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
