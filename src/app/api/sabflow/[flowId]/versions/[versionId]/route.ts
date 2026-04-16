/**
 * SabFlow — Single version API
 *
 * GET /api/sabflow/[flowId]/versions/[versionId]
 *   Returns: { version: Version }  — includes the full snapshot for diffing
 *   404 when the version does not exist for the given flow.
 *
 * Only the flow owner (userId match) may read.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowById, getVersionById } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ flowId: string; versionId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { flowId, versionId } = await params;

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const flow = await getSabFlowById(flowId);
  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }

  const userId = session.user._id.toString();
  if (flow.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const version = await getVersionById(flowId, versionId);
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    // Serialise ObjectId fields inside the snapshot for safe JSON transport.
    const serialised = JSON.parse(JSON.stringify(version));
    return NextResponse.json({ version: serialised });
  } catch (err) {
    console.error('[SABFLOW VERSION] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
