/**
 * POST /api/v1/oauth/introspect — RFC 7662 token introspection.
 * Public; hand-written. See `/api/v1/oauth/token` for rationale.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function rustBaseUrl(): string {
  return process.env.RUST_API_URL || process.env.RUST_BACKEND_URL || 'http://localhost:8080';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let token = '';
  try {
    const ct = (req.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/x-www-form-urlencoded')) {
      token = new URLSearchParams(await req.text()).get('token') ?? '';
    } else {
      const body = (await req.json()) as { token?: unknown };
      token = typeof body.token === 'string' ? body.token : '';
    }
  } catch {
    /* leave empty */
  }
  if (!token) {
    return NextResponse.json({ active: false }, { status: 200 });
  }

  try {
    const res = await fetch(`${rustBaseUrl()}/v1/oauth/introspect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return NextResponse.json(await res.json().catch(() => ({ active: false })), {
      status: res.status,
    });
  } catch (err) {
    console.error('[oauth/introspect] upstream error:', err);
    return NextResponse.json({ active: false }, { status: 200 });
  }
}
