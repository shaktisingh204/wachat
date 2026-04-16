/**
 * POST /api/sabflow/[flowId]/publish
 *
 * Toggles the flow's `status` between 'DRAFT' and 'PUBLISHED'.
 * Requires an authenticated session — the caller must own the flow.
 *
 * Response 200: { status: 'DRAFT' | 'PUBLISHED' }
 * Response 400: { error: string }
 * Response 401: { error: string }
 * Response 404: { error: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import type { FlowStatus } from '@/components/sabflow/panels/SharePanel';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  /* ── Auth ─────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { flowId } = await params;

  if (!ObjectId.isValid(flowId)) {
    return NextResponse.json({ error: 'Invalid flow ID' }, { status: 400 });
  }

  /* ── Load current doc & toggle ───────────────────────── */
  try {
    const col = await getSabFlowCollection();
    const userId = session.user._id.toString();

    const doc = await col.findOne(
      { _id: new ObjectId(flowId), userId },
      { projection: { status: 1 } },
    );

    if (!doc) {
      return NextResponse.json({ error: 'Flow not found or access denied' }, { status: 404 });
    }

    const nextStatus: FlowStatus = doc.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';

    await col.updateOne(
      { _id: new ObjectId(flowId), userId },
      { $set: { status: nextStatus, updatedAt: new Date() } },
    );

    console.info('[sabflow/publish] toggled', { flowId, userId, nextStatus });
    return NextResponse.json({ status: nextStatus });
  } catch (err) {
    console.error('[sabflow/publish] unexpected error', { flowId, err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
