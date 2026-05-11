/**
 * SabFlow — List executions
 *
 * GET /api/sabflow/executions?flowId=xxx&limit=50&status=xxx
 *   → { executions: ExecutionRow[] }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const projectId =
    (session.user as { _id?: string | { toString(): string }; id?: string })._id?.toString()
    ?? (session.user as { id?: string }).id
    ?? '';

  const { searchParams } = new URL(req.url);
  const flowId = searchParams.get('flowId') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200);

  try {
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { projectId };
    if (flowId) filter.flowId = flowId;
    if (status) filter.status = status;

    const executions = await db
      .collection('sabflow_executions')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      executions: executions.map((e) => ({
        ...e,
        _id: e._id.toHexString(),
      })),
    });
  } catch (err) {
    console.error('[SABFLOW EXECUTIONS] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
