import { NextResponse } from 'next/server';
import type { CronJob } from '@/lib/cron/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Registry of cron jobs. Each entry lazy-imports its module so a parse
 * error in one job doesn't crash the route for the others.
 */
const JOBS: Record<string, () => Promise<{ default: CronJob }>> = {
  'recurring-invoices': () => import('@/lib/cron/jobs/recurring-invoices'),
  'recurring-events': () => import('@/lib/cron/jobs/recurring-events'),
  'recurring-tasks': () => import('@/lib/cron/jobs/recurring-tasks'),
  'recurring-expenses': () => import('@/lib/cron/jobs/recurring-expenses'),
  'shift-rotation': () => import('@/lib/cron/jobs/shift-rotation'),
  'auto-clock-out': () => import('@/lib/cron/jobs/auto-clock-out'),
  'follow-up-reminders': () => import('@/lib/cron/jobs/follow-up-reminders'),
  'visa-passport-expiry-alerts': () =>
    import('@/lib/cron/jobs/visa-passport-expiry-alerts'),
  'estimate-contract-expiry': () =>
    import('@/lib/cron/jobs/estimate-contract-expiry'),
  'exchange-rate-update': () => import('@/lib/cron/jobs/exchange-rate-update'),
  'database-backup-retention': () => import('@/lib/cron/jobs/database-backup'),
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ job: string }> },
): Promise<NextResponse> {
  const { job } = await params;
  const url = new URL(req.url);

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on server' },
      { status: 500 },
    );
  }

  // Accept either ?token=... or `Authorization: Bearer ...` so the PM2
  // worker can use whichever transport is easier.
  const headerToken = (req.headers.get('authorization') ?? '').replace(
    /^Bearer\s+/i,
    '',
  );
  const provided = url.searchParams.get('token') ?? headerToken;
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const factory = JOBS[job];
  if (!factory) {
    return NextResponse.json(
      { error: 'Unknown job', available: Object.keys(JOBS) },
      { status: 404 },
    );
  }

  try {
    const mod = await factory();
    const result = await mod.default();
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[cron:${job}] route failure`, message);
    return NextResponse.json(
      { ok: false, job, error: message },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ job: string }> },
): Promise<NextResponse> {
  return GET(req, ctx);
}
