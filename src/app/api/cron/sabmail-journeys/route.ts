/**
 * GET/POST /api/cron/sabmail-journeys
 *
 * SabMail journey / automation tick. Runs one bounded sweep of due
 * `journeyRun` records across ALL workspaces (the engine keys off the
 * `workspaceId` stored on each run + journey — there is no session/cookie in
 * a cron context), executing each run's current node and advancing / sleeping
 * / completing it. The atomic per-run claim inside `tickSabmailJourneys`
 * makes overlapping cron invocations safe.
 *
 * Auth mirrors the other SabMail cron routes: read `process.env.CRON_SECRET`
 * and accept it as `Authorization: Bearer <secret>`, the `x-cron-secret`
 * header, or a `?secret=` query param. When `CRON_SECRET` is NOT set the route
 * is open (local/dev).
 *
 * To schedule in production register this route:
 *   - vercel.json     → add a `crons` entry `{ "path": "/api/cron/sabmail-journeys",
 *                        "schedule": "* * * * *" }` (every minute)
 *   - scripts/cron-worker.mjs → add `{ name: 'sabmail-journeys',
 *                        path: '/api/cron/sabmail-journeys', schedule: '* * * * *' }`
 */

import { NextResponse, type NextRequest } from 'next/server';

import { tickSabmailJourneys } from '@/lib/sabmail/journey-engine';
import { isSabmailEngineEnabled } from '@/lib/sabmail/engine-client';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // not configured → open (local/dev)
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  const header = req.headers.get('x-cron-secret') ?? '';
  if (header === expected) return true;
  const query = new URL(req.url).searchParams.get('secret') ?? '';
  return query === expected;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // When the Rust engine is enabled, its in-process ticker is the SOLE journey
  // driver — running the TS tick here too would risk double-advancing /
  // double-sending the same run. Defer to the engine.
  if (isSabmailEngineEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: 'engine-owned',
      processed: 0,
      advanced: 0,
      completed: 0,
      failed: 0,
      waited: 0,
    });
  }

  try {
    const result = await tickSabmailJourneys();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[sabmail-journeys] tick error:', err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err), processed: 0 },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
