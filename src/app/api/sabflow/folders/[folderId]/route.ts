/**
 * SabFlow folders — rename / delete.
 *
 *   PATCH  /api/sabflow/folders/[folderId]   body: { name?, color? }
 *   DELETE /api/sabflow/folders/[folderId]
 *
 * Rename cascades onto every flow whose `folderId` matched the old name.
 * Delete clears `folderId` on every flow assigned to the folder — flows
 * themselves are never removed.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { deleteFolder, renameFolder } from '@/lib/sabflow/folders/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: { toString(): string }; id?: string };
  return u._id?.toString() ?? u.id ?? null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ folderId: string }> },
) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { folderId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    color?: string;
  };
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  try {
    const ok = await renameFolder(userId, folderId, body.name, body.color);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[SABFLOW FOLDERS PATCH]', err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ folderId: string }> },
) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { folderId } = await ctx.params;
  try {
    const ok = await deleteFolder(userId, folderId);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  } catch (err) {
    console.error('[SABFLOW FOLDERS DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
