import { NextRequest, NextResponse } from 'next/server';

import { sweepExpirations, sweepReminders } from '@/lib/sabsign/reminders';

/**
 * SabSign lifecycle cron: expires overdue envelopes + sends signing reminders.
 *
 * Wire to a scheduler (Vercel Cron / external) hitting this route on an
 * interval (e.g. hourly). Gated by `CRON_SECRET` (sent as
 * `Authorization: Bearer <secret>` by Vercel Cron, or `?secret=` for manual
 * runs). In development without a secret it is open for convenience.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = req.headers.get('authorization');
  return (
    header === `Bearer ${secret}` ||
    req.nextUrl.searchParams.get('secret') === secret
  );
}

async function run() {
  const expired = await sweepExpirations();
  const reminded = await sweepReminders();
  return { ok: true as const, expired, reminded, at: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export const POST = GET;
