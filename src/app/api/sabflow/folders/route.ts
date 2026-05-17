/**
 * SabFlow folders — list / create.
 *
 *   GET  /api/sabflow/folders
 *   POST /api/sabflow/folders   body: { name, color? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { createFolder, listFolders } from '@/lib/sabflow/folders/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: { toString(): string }; id?: string };
  return u._id?.toString() ?? u.id ?? null;
}

export async function GET() {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const folders = await listFolders(userId);
    return NextResponse.json({ folders });
  } catch (err) {
    console.error('[SABFLOW FOLDERS LIST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    color?: string;
  };
  try {
    const folder = await createFolder(userId, body.name ?? '', body.color);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[SABFLOW FOLDERS CREATE]', err);
    const status = msg.includes('already exists') ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
