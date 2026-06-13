/**
 * GET/POST /api/cron/sabmail-snooze
 *
 * SabMail "Snooze" sweep. Deletes every EXPIRED snooze (snoozedUntil <= now)
 * across ALL workspaces. The inbox reads live IMAP, so deleting the snooze
 * record is all that's needed — the message naturally reappears in the inbox
 * on the next list (nothing about the real mailbox is ever touched).
 *
 * Auth mirrors `/api/cron/sabmail-scheduled`: read `process.env.CRON_SECRET`
 * and compare it to `Authorization: Bearer <secret>`, the `x-cron-secret`
 * header, or the `?secret=` query. When `CRON_SECRET` is set and the value
 * doesn't match → 401. When it is not set, the route is open (local/dev).
 *
 * Register in vercel cron / the repo cron-worker to run every minute.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';
import type { SabmailSnoozeDoc } from '@/app/sabmail/inbox/snooze-actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // not configured → open (local/dev)
  // Vercel Cron + the repo cron-worker send `Authorization: Bearer <secret>`.
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

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SabmailSnoozeDoc>(SABMAIL_COLLECTIONS.snoozes);

    // Expired snoozes resurface by simply ceasing to exist — the next inbox
    // list stops filtering their uids out. Sweep across ALL workspaces.
    const res = await col.deleteMany({ snoozedUntil: { $lte: new Date() } });
    const resurfaced = res.deletedCount ?? 0;

    return NextResponse.json({ ok: true, resurfaced });
  } catch (err) {
    console.error('[sabmail-snooze] sweep error:', err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err), resurfaced: 0 },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
