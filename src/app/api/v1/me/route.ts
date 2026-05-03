/**
 * GET /api/v1/me — return the calling tenant identity and granted scopes.
 *
 * Auth: API key with `me:read` scope (or `*`).  Subject to the standard
 * tier rate limit.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  consumeToken,
  rateLimitHeaders,
  requireScope,
  verifyApiKey,
} from '@/lib/api-platform';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await verifyApiKey(req);
  if (!ctx) {
    return NextResponse.json(
      { error: 'Missing or invalid API key' },
      { status: 401 },
    );
  }

  const limit = await consumeToken(ctx.keyId, ctx.tier);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  if (!requireScope('me:read', ctx)) {
    return NextResponse.json(
      { error: 'Missing required scope: me:read' },
      { status: 403, headers: rateLimitHeaders(limit) },
    );
  }

  return NextResponse.json(
    {
      tenant_id: ctx.tenantId,
      scopes: ctx.scopes,
      tier: ctx.tier,
    },
    { headers: rateLimitHeaders(limit) },
  );
}
