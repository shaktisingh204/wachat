/**
 * GET /api/v1/openapi — return the public OpenAPI 3.1 document for the v1 API.
 *
 * Unauthenticated and cacheable.  This is the source of truth for SDK
 * generators and is regenerated on every request from the in-process
 * builder so it can never drift from the routes.
 */

import { NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/api-platform/openapi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    const spec = buildOpenApiSpec();
    return NextResponse.json(spec, {
      headers: { 'cache-control': 'public, max-age=60' },
    });
  } catch (err) {
    console.error('[api/v1/openapi] failed to build spec', err);
    return NextResponse.json({ error: 'Failed to build OpenAPI spec' }, { status: 500 });
  }
}
