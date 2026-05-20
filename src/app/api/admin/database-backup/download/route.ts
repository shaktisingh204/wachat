import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-only download for a stored database backup. Streams the gzipped
 * archive straight from disk; the row is looked up in
 * `database_backups` to resolve the file path.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const { db } = await connectToDatabase();
  const row = await db.collection('database_backups').findOne({ _id: new ObjectId(id) });
  if (!row) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  const filePath = String(row.path);
  try {
    const buf = await fs.readFile(filePath);
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    console.log('[admin/database-backup/download] served backup', {
      id,
      filename: String(row.filename ?? ''),
      bytes: buf.byteLength,
      actorId: String(session.user._id ?? ''),
    });
    return new NextResponse(arrayBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${String(row.filename ?? 'backup.gz')}"`,
        'Content-Length': String(buf.byteLength),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to read backup file';
    console.error('[admin/database-backup/download] read failed', {
      id,
      filePath,
      error: message,
      actorId: String(session.user._id ?? ''),
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
