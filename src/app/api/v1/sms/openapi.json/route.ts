import { NextResponse } from 'next/server';

import { buildSabsmsOpenApiSpec } from '@/lib/sabsms/apikeys/openapi';

/**
 * Public API — `GET /api/v1/sms/openapi.json`.
 *
 * The machine-readable OpenAPI 3.1 description of the SabSMS public
 * API. Unauthenticated by design (it documents how to authenticate).
 */
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(buildSabsmsOpenApiSpec(), {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
