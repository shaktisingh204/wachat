/**
 * Presence heartbeat endpoint — wraps `heartbeatSabwriterPresence`.
 */
import { NextResponse } from 'next/server';

import { heartbeatSabwriterPresence } from '@/app/actions/sabwriter.actions';
import type { HeartbeatInput } from '@/lib/rust-client/sabwriter-presence';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HeartbeatInput;
    if (!body?.documentId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const res = await heartbeatSabwriterPresence(body);
    return NextResponse.json(res);
  } catch (err) {
    console.error('[sabwriter] heartbeat failed', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
