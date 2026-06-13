/**
 * SabCRM — service-case SLA sweep cron (`/api/cron/sabcrm-sla`).
 *
 * Recomputes `data.slaStatus` + `data.__sla` for every OPEN case across every
 * project that configured a case SLA policy, catching cases that crossed a
 * warning / breach edge purely with the passage of time (no record mutation
 * fires for that). Writes use the AI-fields scalar envelope (NO `updatedAt`
 * bump) and a NOTE-type breach activity is logged once per case. Schedule it
 * every ~15 minutes so SLA badges stay fresh.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (mirrors the other cron routes);
 * `x-cron-secret: $secret` is also accepted.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import {
  scanAllSlaBreaches,
  ensureCaseIndexes,
} from '@/lib/sabcrm/cases.server';

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
    await ensureCaseIndexes(db);
    const report = await scanAllSlaBreaches(Date.now());
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
