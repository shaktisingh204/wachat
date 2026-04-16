/**
 * GET /api/sabflow/export/[flowId]
 *
 * Exports a SabFlow document as a downloadable JSON file.
 * Only the authenticated owner may export their own flow.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowCollection } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;

  /* ── Auth ─────────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  /* ── Validate ID ─────────────────────────────────────────────────────── */
  if (!ObjectId.isValid(flowId)) {
    return NextResponse.json({ error: 'Invalid flow ID' }, { status: 400 });
  }

  try {
    /* ── Fetch (ownership-scoped) ──────────────────────────────────────── */
    const col = await getSabFlowCollection();
    const doc = await col.findOne({
      _id: new ObjectId(flowId),
      userId: session.user._id.toString(),
    });

    if (!doc) {
      return NextResponse.json({ error: 'Flow not found or access denied' }, { status: 404 });
    }

    /* ── Serialise: ObjectId → string so JSON.stringify is safe ─────────── */
    const serialised = JSON.parse(JSON.stringify(doc));

    const filename = `flow-${flowId}.json`;
    const body = JSON.stringify({ flow: serialised }, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[SABFLOW EXPORT] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
