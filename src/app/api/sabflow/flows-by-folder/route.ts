/**
 * SabFlow flows-by-folder — flows assigned to a folder.
 *
 *   GET /api/sabflow/flows-by-folder?folder=<name>
 *
 * Returns `{ count, flows: [{ id, name }] }` for the caller's flows whose
 * `folderId` matches the given folder. Note: `SabFlowDoc.folderId` currently
 * stores the folder NAME (see Step 6 in `lib/sabflow/folders/db.ts` — rename
 * and delete cascade by name), so the lookup matches on the name the folders
 * page passes.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowsByUserId } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: { toString(): string }; id?: string };
  return u._id?.toString() ?? u.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const folder = req.nextUrl.searchParams.get('folder')?.trim();
  if (!folder) {
    return NextResponse.json(
      { error: 'Missing `folder` query parameter' },
      { status: 400 },
    );
  }
  try {
    const flows = await getSabFlowsByUserId(userId);
    const matched = flows.filter((f) => f.folderId === folder);
    return NextResponse.json({
      count: matched.length,
      flows: matched.map((f) => ({
        id: f._id?.toString() ?? '',
        name: f.name,
      })),
    });
  } catch (err) {
    console.error('[SABFLOW FLOWS BY FOLDER]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
