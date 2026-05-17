/**
 * POST /api/v1/oauth/revoke — RFC 7009 token revocation.
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
  let body: { token?: unknown } = {};
  try {
    const ct = (req.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(await req.text());
      body = { token: params.get('token') ?? undefined };
    } else {
      body = (await req.json()) as { token?: unknown };
    }
  } catch {
    /* leave empty */
  }
  if (typeof body.token !== 'string' || !body.token) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const res = await fetch(`${rustBaseUrl()}/v1/oauth/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: body.token }),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    console.error('[oauth/revoke] upstream error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 502 });
  }
}
