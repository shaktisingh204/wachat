/**
 * SabFlow — Version restore API
 *
 * POST /api/sabflow/[flowId]/versions/[versionId]/restore
 *   Overwrites the live flow with the chosen version snapshot.
 *   Returns: { flow: SabFlowDoc (serialised) }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowById, restoreVersion } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ flowId: string; versionId: string }> };

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { flowId, versionId } = await params;

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Ownership check
  const flow = await getSabFlowById(flowId);
  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }

  const userId = session.user._id.toString();
  if (flow.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const restored = await restoreVersion(flowId, versionId);
    // Serialise ObjectId fields for safe JSON transport
    const serialised = JSON.parse(JSON.stringify(restored));
    return NextResponse.json({ flow: serialised });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message === 'Version not found' ? 404 : 500;
    console.error('[SABFLOW RESTORE] POST error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
