/**
 * SabFlow — Version history API
 *
 * GET  /api/sabflow/[flowId]/versions
 *   Returns: { versions: Version[] }
 *
 * POST /api/sabflow/[flowId]/versions
 *   Body: { label?: string }
 *   Returns: { versionId: string }
 *
 * Only the flow owner (userId match) may read or write versions.
 * Max 20 versions per flow — oldest is deleted when exceeded.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowById, saveVersion, getVersions } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ flowId: string }> };

/* ── GET ─────────────────────────────────────────────────── */

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { flowId } = await params;

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
    const versions = await getVersions(flowId);
    return NextResponse.json({ versions });
  } catch (err) {
    console.error('[SABFLOW VERSIONS] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── POST ────────────────────────────────────────────────── */

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { flowId } = await params;

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

  let label: string | undefined;
  try {
    const body = (await req.json()) as { label?: string };
    label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : undefined;
  } catch {
    // label is optional — ignore parse errors
  }

  try {
    const versionId = await saveVersion(flowId, flow, label, userId);
    return NextResponse.json({ versionId }, { status: 201 });
  } catch (err) {
    console.error('[SABFLOW VERSIONS] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
