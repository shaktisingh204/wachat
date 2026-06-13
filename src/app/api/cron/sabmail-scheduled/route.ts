/**
 * GET/POST /api/cron/sabmail-scheduled
 *
 * SabMail "Send later" sweep. Finds every `pending` scheduled send whose
 * `sendAt` has passed (across ALL workspaces) and drives it through the
 * existing send action, then marks each doc `sent` or `failed`.
 *
 * Auth mirrors the other cron routes: read `process.env.CRON_SECRET` and
 * compare it to the `x-cron-secret` header (or `?secret=` query). When
 * `CRON_SECRET` is set and the value doesn't match → 401. When it is not set,
 * the route is open (local/dev).
 *
 * Register in vercel cron / the repo cron-worker to run every minute.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { sendSabmailMessageForWorkspace } from '@/app/sabmail/inbox/actions';
import { getErrorMessage } from '@/lib/utils';
import type { SabmailScheduledDoc } from '@/app/sabmail/scheduled/actions';

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

  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SabmailScheduledDoc>(SABMAIL_COLLECTIONS.scheduled);

    const due = (await col
      .find({ status: 'pending', sendAt: { $lte: new Date() } })
      .limit(100)
      .toArray()) as WithId<SabmailScheduledDoc>[];

    for (const item of due) {
      processed += 1;
      try {
        const res = await sendSabmailMessageForWorkspace(item.workspaceId, {
          accountId: item.accountId,
          to: item.payload?.to ?? [],
          cc: item.payload?.cc,
          bcc: item.payload?.bcc,
          subject: item.payload?.subject ?? '(no subject)',
          html: item.payload?.html,
        });
        if (res.ok) {
          await col.updateOne(
            { _id: item._id },
            { $set: { status: 'sent', sentAt: new Date() }, $unset: { error: '' } },
          );
          sent += 1;
        } else {
          await col.updateOne(
            { _id: item._id },
            { $set: { status: 'failed', error: res.error } },
          );
          failed += 1;
        }
      } catch (e) {
        await col.updateOne(
          { _id: item._id },
          { $set: { status: 'failed', error: getErrorMessage(e) } },
        );
        failed += 1;
      }
    }

    return NextResponse.json({ processed, sent, failed });
  } catch (err) {
    console.error('[sabmail-scheduled] sweep error:', err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err), processed, sent, failed },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
