/**
 * GET|POST /api/cron/sabsheet-connections
 *
 * SabSheet v2 live-data-connection refresh tick. Scans `sabsheet_connections`
 * for ACTIVE interval connections whose `lastRunAt` is older than their
 * `everyMinutes`, caps the batch (50/tick), and runs each (poll source + land
 * rows into the sheet). Individual failures are isolated — one bad source can't
 * stall the rest — and recorded on the connection doc by the run module.
 *
 * Auth matches the other cron routes: `Authorization: Bearer ${CRON_SECRET}`,
 * falling back to the `vercel-cron: 1` header when no secret is configured.
 *
 * Wire into the master cron worker (`scripts/cron-worker.mjs`) with:
 *   { name: 'sabsheet-connections', path: '/api/cron/sabsheet-connections', schedule: '* * * * *' }
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { SABSHEET_CONNECTIONS_COLLECTION } from '@/lib/sabsheet/connections/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_PER_TICK = 50;

function isAuthorisedCronRequest(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return req.headers.get('vercel-cron') === '1';
  }
  return auth === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!isAuthorisedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const { db } = await connectToDatabase();
    const now = Date.now();

    // Pull a working set of active interval connections, oldest run first, then
    // filter due-ness in JS (per-connection everyMinutes can't be expressed in
    // a single Mongo predicate). Bound the scan generously above the run cap.
    const candidates = await db
      .collection(SABSHEET_CONNECTIONS_COLLECTION)
      .find({ status: 'active', 'schedule.mode': 'interval' })
      .sort({ lastRunAt: 1 })
      .limit(MAX_PER_TICK * 4)
      .toArray();

    const due = candidates.filter((d: any) => {
      const every = Math.max(1, Number(d?.schedule?.everyMinutes) || 60);
      const last = d?.lastRunAt instanceof Date ? d.lastRunAt.getTime() : 0;
      return now - last >= every * 60_000;
    });

    const batch = due.slice(0, MAX_PER_TICK);

    // Late import keeps the route's static graph light and avoids pulling the
    // `server-only` run module into any edge analysis of the cron tree.
    const { fromCronDoc, runAndLand } = await import('./_run');

    let ran = 0;
    let failed = 0;
    for (const doc of batch) {
      try {
        const result = await runAndLand(fromCronDoc(doc));
        ran++;
        if (!result.ok) failed++;
      } catch (err) {
        failed++;
        console.error('[sabsheet-connections] connection run threw:', err);
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: candidates.length,
      due: due.length,
      ran,
      failed,
      capped: due.length > MAX_PER_TICK,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[sabsheet-connections] tick error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
