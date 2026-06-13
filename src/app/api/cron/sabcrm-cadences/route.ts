/**
 * SabCRM — multichannel cadence runner cron (`/api/cron/sabcrm-cadences`).
 *
 * Advances every due cadence enrollment one step (email / SMS / WhatsApp / task)
 * via the in-house channel dispatchers, then schedules the next step. Schedule it
 * frequently (e.g. `* * * * *`) — the per-(enrollment, stepIndex) ledger makes
 * re-ticks idempotent.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (mirrors the other cron routes);
 * `x-cron-secret: $secret` is also accepted.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  runDueCadenceEnrollments,
  ensureCadenceEnrollmentIndexes,
} from '@/lib/sabcrm/cadence-runner.server';
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
    await ensureCadenceEnrollmentIndexes(db);
    const report = await runDueCadenceEnrollments(Date.now());
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
