/**
 * DELETE /api/sabflow/upload/[id]
 *
 * Removes a previously uploaded file from both the storage backend and the
 * metadata collection.  The caller must own the workspace that uploaded the
 * file.
 *
 * Response 200: { ok: true }
 * Response 401: Authentication required
 * Response 403: Access denied (workspace mismatch)
 * Response 404: File not found
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getFileById, deleteFile } from '@/lib/sabflow/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const file = await getFileById(id);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const userId = session.user._id.toString();
    if (file.workspaceId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await deleteFile(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[sabflow/upload DELETE] failed', { id, err });
    return NextResponse.json(
      { error: 'Internal server error' },

    );
  }
}
