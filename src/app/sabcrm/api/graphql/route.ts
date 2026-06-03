import 'server-only';

import type { NextRequest } from 'next/server';

import { proxyToTwenty } from '../_proxy';

/**
 * Phase 1B — proxy `/sabcrm/api/graphql` → twenty-server `/graphql` (records).
 * Thin pass-through; no auth bridging yet (Phase 4).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req: NextRequest) {
  return proxyToTwenty(req, '/graphql');
}

export function GET(req: NextRequest) {
  return proxyToTwenty(req, '/graphql');
}
