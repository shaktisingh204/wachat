/**
 * SabCRM — activity auto-capture calendar cron (`/api/cron/sabcrm-autocapture`).
 *
 * Pulls recent Google Calendar events for every auto-capture-enabled project
 * and logs MEETING activities onto matching records (idempotent on the Google
 * event id). Inbound EMAIL capture rides the inbound-email webhook live; this
 * cron only drives the calendar side. Schedule it every ~15-30 min
 * (e.g. `*\/15 * * * *`).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (mirrors the other cron routes);
 * `x-cron-secret: $secret` is also accepted.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { captureCalendarForAllProjects } from '@/lib/sabcrm/auto-capture.server';

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
    const report = await captureCalendarForAllProjects();
    const activitiesLogged = report.reduce((n, r) => n + r.activitiesLogged, 0);
    return NextResponse.json({
      ok: true,
      projects: report.length,
      activitiesLogged,
      report,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
