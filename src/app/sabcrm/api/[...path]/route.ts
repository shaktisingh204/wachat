import 'server-only';

import type { NextRequest } from 'next/server';

import { proxyToTwenty } from '../_proxy';

/**
 * Phase 1B — catch-all proxy for every other `/sabcrm/api/*` path → twenty-server.
 *
 * Covers `admin-panel`, `rest` (and its sub-paths), health checks, and any
 * additional twenty-server endpoint. `/graphql` and `/metadata` have their own
 * dedicated handlers (more specific routes win), so they never reach here.
 *
 * Thin pass-through; no auth bridging yet (Phase 4).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  const downstreamPath = `/${(path ?? []).map(encodeURIComponent).join('/')}`;
  return proxyToTwenty(req, downstreamPath);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
