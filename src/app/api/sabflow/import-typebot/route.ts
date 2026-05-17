/**
 * POST /api/sabflow/import-typebot
 *
 * Body: a raw Typebot v6 JSON export.  Returns the id of a newly-created
 * SabFlow document seeded from the import, plus any warnings collected
 * during the conversion (unknown block types, dropped edges, etc.).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { importTypebotWorkflow } from '@/lib/sabflow/interop/typebotImport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log('[SABFLOW IMPORT-TYPEBOT] request received');
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

    const imported = importTypebotWorkflow(body);

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
      `[SABFLOW IMPORT-TYPEBOT] ok user=${userId} flow=${flowId.toHexString()} blocks=${imported.blocks} edges=${imported.edges} warnings=${imported.warnings.length}`,
    );
    return NextResponse.json({
      flowId: flowId.toHexString(),
      name: imported.doc.name,
      blocks: imported.blocks,
      warnings: imported.warnings,
    });
  } catch (err) {
    console.error('[SABFLOW IMPORT-TYPEBOT] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 400 },
    );
  }
}
