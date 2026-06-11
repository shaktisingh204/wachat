/**
 * SabFlow — Single execution detail
 *
 * GET /api/sabflow/executions/[executionId]
 *   → { execution: ExecutionHistoryEntry } | { error }
 *
 * Powers the replay view; authorises by checking the flow belongs to the
 * caller's project.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getExecutionById } from '@/lib/sabflow/db';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ executionId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { executionId } = await ctx.params;
  if (!executionId) {
    return NextResponse.json({ error: 'Missing executionId' }, { status: 400 });
  }

  try {
    const execution = await getExecutionById(executionId);
    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // Authorise: the execution's flow must belong to the caller's project.
    const projectId =
      (session.user as { _id?: string | { toString(): string }; id?: string })._id?.toString()
      ?? (session.user as { id?: string }).id
      ?? '';

    const { db } = await connectToDatabase();
    if (!ObjectId.isValid(execution.flowId)) {
      return NextResponse.json({ error: 'Invalid flow id' }, { status: 400 });
    }
    // Flows live in `sabflows` (this previously queried a nonexistent
    // `sabflow_flows` collection, so every replay-detail request 404'd).
    const flow = await db.collection('sabflows').findOne(
      { _id: new ObjectId(execution.flowId) },
      { projection: { projectId: 1, userId: 1, name: 1 } },
    );
    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    if (flow.projectId !== projectId && flow.userId !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      execution,
      flow: { id: execution.flowId, name: flow.name as string | undefined },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[SABFLOW EXECUTION DETAIL] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
