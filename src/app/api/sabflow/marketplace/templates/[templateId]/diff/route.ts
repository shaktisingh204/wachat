/**
 * GET /api/sabflow/marketplace/templates/[templateId]/diff
 *
 * Phase C.10.7 — Template versioning + upgrade diff.
 *
 * Query params:
 *   from  — the installed version string, e.g. "1.0.0"
 *   to    — the target version string, e.g. "1.1.0"
 *
 * Response (200):
 *   {
 *     addedNodes:        string[],
 *     removedNodes:      string[],
 *     changedNodes:      string[],
 *     addedConnections:  number,
 *     removedConnections: number,
 *   }
 *
 * Response (400) — missing / invalid query params
 * Response (401) — not authenticated
 * Response (404) — one or both versions not found for this template
 * Response (500) — unexpected error
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getSession } from '@/app/actions/user.actions';
import { computeUpgradeDiff } from '@/lib/sabflow/marketplace/versioning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ templateId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  /* ── Auth ────────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  /* ── Params ─────────────────────────────────────────────────────────── */
  const { templateId } = await context.params;
  const { searchParams } = request.nextUrl;
  const fromVersion = searchParams.get('from')?.trim() ?? '';
  const toVersion = searchParams.get('to')?.trim() ?? '';

  if (!templateId) {
    return NextResponse.json(
      { error: '`templateId` path parameter is required' },
      { status: 400 },
    );
  }
  if (!fromVersion) {
    return NextResponse.json(
      { error: '`from` query parameter is required' },
      { status: 400 },
    );
  }
  if (!toVersion) {
    return NextResponse.json(
      { error: '`to` query parameter is required' },
      { status: 400 },
    );
  }
  if (fromVersion === toVersion) {
    return NextResponse.json(
      { error: '`from` and `to` must be different versions' },
      { status: 400 },
    );
  }

  /* ── Compute diff ───────────────────────────────────────────────────── */
  try {
    const diff = await computeUpgradeDiff(templateId, fromVersion, toVersion);
    if (!diff) {
      return NextResponse.json(
        { error: 'One or both versions not found for this template' },
        { status: 404 },
      );
    }

    return NextResponse.json(diff, { status: 200 });
  } catch (err) {
    console.error('[SABFLOW MARKETPLACE DIFF] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
