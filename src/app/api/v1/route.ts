/**
 * GET /api/v1 — public API metadata.
 *
 * Unauthenticated.  Used by SDKs and uptime probes to discover the API
 * version and the location of the OpenAPI document / docs.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    version: '1.0.0',
    status: 'ok',
    docs_url: '/api/v1/openapi',
  });
}
