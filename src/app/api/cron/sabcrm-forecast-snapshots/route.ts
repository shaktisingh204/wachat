/**
 * SabCRM — forecast snapshots cron (`/api/cron/sabcrm-forecast-snapshots`).
 *
 * Freezes a daily per-(project,object) win/lost/open rollup into
 * `sabcrm_forecast_snapshots` for commit-vs-actual trend charting. Schedule it
 * daily (e.g. `0 1 * * *`).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (mirrors the other cron routes);
 * `x-cron-secret: $secret` is also accepted.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  snapshotAllForecasts,
  ensureSnapshotIndex,
} from '@/lib/sabcrm/forecast-snapshots.server';
import { ensureSabcrmFeatureIndexes } from '@/lib/sabcrm/feature-indexes.server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function guard(
  request: NextRequest,
): { ok: true } | { ok: false; status: number; body: { error: string } } {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return { ok: false, status: 500, body: { error: 'CRON_SECRET not configured' } };
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return { ok: true };
  if ((request.headers.get('x-cron-secret') ?? '') === expected) return { ok: true };
  return { ok: false, status: 401, body: { error: 'Unauthorized' } };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const g = guard(request);
  if (!g.ok) return NextResponse.json(g.body, { status: g.status });
  try {
    const { db } = await connectToDatabase();
    await ensureSnapshotIndex(db);
    // Daily best-effort: keep the beyond-CRUD feature collections indexed in
    // production (notifications / comments / inbox / webhooks / attribution /
    // per-project config). Idempotent + never throws.
    const indexes = await ensureSabcrmFeatureIndexes(db);
    const report = await snapshotAllForecasts(Date.now());
    return NextResponse.json({ ok: true, indexes, ...report });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
