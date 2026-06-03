import 'server-only';

import type { NextRequest } from 'next/server';

import { proxyToTwenty } from '../_proxy';

/**
 * Phase 1B — proxy `/sabcrm/api/metadata` → twenty-server `/metadata`
 * (object/field metadata GraphQL). Thin pass-through; no auth bridging yet
 * (Phase 4).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req: NextRequest) {
  return proxyToTwenty(req, '/metadata');
}

export function GET(req: NextRequest) {
  return proxyToTwenty(req, '/metadata');
}
