/**
 * Presence list endpoint — wraps `listSabwriterPresence` so client-side
 * polling transports (MockTransport et al.) can `fetch()` it without a
 * server action round-trip.
 */
import { NextResponse } from 'next/server';

import { listSabwriterPresence } from '@/app/actions/sabwriter.actions';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentId = url.searchParams.get('documentId');
  if (!documentId) {
    return NextResponse.json({ items: [] });
  }
  try {
    const res = await listSabwriterPresence(documentId);
    return NextResponse.json(res);
  } catch (err) {
    console.error('[sabwriter] presence list failed', err);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
