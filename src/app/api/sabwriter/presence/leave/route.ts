/**
 * Presence leave endpoint — wraps `leaveSabwriterPresence`.
 */
import { NextResponse } from 'next/server';

import { leaveSabwriterPresence } from '@/app/actions/sabwriter.actions';

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const documentId = url.searchParams.get('documentId');
  if (!documentId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const res = await leaveSabwriterPresence(documentId);
    return NextResponse.json(res);
  } catch (err) {
    console.error('[sabwriter] leave failed', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
