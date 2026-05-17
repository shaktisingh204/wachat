/**
 * POST /api/v1/oauth/token — RFC 6749 token endpoint.
 *
 * Public (no API-key auth). Authenticates via `client_id` + optional
 * `client_secret` + PKCE verifier. Forwards to the Rust
 * `developer-oauth` crate which owns code/token storage.
 *
 * Hand-written rather than manifest-driven because the manifest pipeline
 * routes every endpoint through `withApiV1`'s API-key gate — `/token`
 * exists *before* a tenant has any developer credentials so that gate
 * would be wrong.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function rustBaseUrl(): string {
  return process.env.RUST_API_URL || process.env.RUST_BACKEND_URL || 'http://localhost:8080';
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    try {
      return (await req.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const out: Record<string, unknown> = {};
    for (const [k, v] of params) out[k] = v;
    return out;
  }
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await readBody(req);
  if (!body || typeof body.grant_type !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'grant_type is required' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${rustBaseUrl()}/v1/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    console.error('[oauth/token] upstream error:', err);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Upstream OAuth server unreachable.' },
      { status: 502 },
    );
  }
}
