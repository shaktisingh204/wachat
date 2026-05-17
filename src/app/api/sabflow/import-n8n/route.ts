/**
 * POST /api/sabflow/import-n8n
 *
 * Body: a raw n8n `workflow.json` export.  Returns the id of a newly-created
 * SabFlow document seeded from the import, plus a count of nodes that
 * fell back to a typebot_link stub for manual remapping.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { importN8nWorkflow } from '@/lib/sabflow/interop/n8nImport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log('[SABFLOW IMPORT-N8N] request received');
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = (session.user as { _id: { toString(): string } })._id.toString();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
    }

    const imported = importN8nWorkflow(body);

    const now = new Date();
    const flowId = new ObjectId();
    const doc = {
      _id: flowId,
      userId,
      ...imported.doc,
      status: 'DRAFT' as const,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const { db } = await connectToDatabase();
    await db.collection('sabflows').insertOne(doc);

    console.log(
      `[SABFLOW IMPORT-N8N] ok user=${userId} flow=${flowId.toHexString()} blocks=${imported.blocks} stubbed=${imported.stubbed.length}`,
    );
    return NextResponse.json({
      flowId: flowId.toHexString(),
      name: imported.doc.name,
      blocks: imported.blocks,
      triggers: imported.triggers,
      stubbed: imported.stubbed,
    });
  } catch (err) {
    console.error('[SABFLOW IMPORT-N8N] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 400 },
    );
  }
}
