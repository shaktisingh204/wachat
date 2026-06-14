import 'server-only';

import { connectToDatabase } from '@/lib/mongodb';
import { sendReminderEmails } from '@/lib/sabsign/notify';
import type { SabSignEnvelopeDoc } from '@/lib/rust-client/sabsign-envelopes';

/**
 * Background sweeps for the envelope lifecycle, run by the reminders cron
 * (`/api/sabsign/cron/reminders`). Operates directly on `esign_envelopes`
 * across ALL tenants — these are system operations with no session/tenant
 * context. `_id` is a string and timestamps are ISO-8601 strings (so `$lt`
 * string comparison is chronological).
 */

const ACTIVE = ['sent', 'in_progress'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Transition envelopes past their `expiresAt` to `expired`. Returns count. */
export async function sweepExpirations(): Promise<number> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const res = await db.collection('esign_envelopes').updateMany(
    { status: { $in: ACTIVE }, expiresAt: { $type: 'string', $lt: now } },
    { $set: { status: 'expired', updatedAt: now } },
  );
  return res.modifiedCount ?? 0;
}

/**
 * Re-send signing links for active envelopes whose `reminderDays` interval has
 * elapsed since the last reminder (or since creation). Returns the number of
 * envelopes reminded.
 */
export async function sweepReminders(limit = 500): Promise<number> {
  const { db } = await connectToDatabase();
  const nowMs = Date.now();
  const candidates = await db
    .collection('esign_envelopes')
    .find({ status: { $in: ACTIVE }, reminderDays: { $gt: 0 } })
    .limit(limit)
    .toArray();

  let reminded = 0;
  for (const raw of candidates) {
    const env = raw as unknown as SabSignEnvelopeDoc & { lastReminderAt?: string };
    const days = Number(env.reminderDays ?? 0);
    if (!days) continue;
    const anchorStr = env.lastReminderAt || env.updatedAt || env.createdAt;
    const anchor = anchorStr ? Date.parse(anchorStr) : NaN;
    if (!Number.isFinite(anchor)) continue;
    if (nowMs - anchor < days * DAY_MS) continue; // not due yet

    const r = await sendReminderEmails(env);
    if (r.sent > 0) {
      await db
        .collection('esign_envelopes')
        .updateOne(
          { _id: env._id as unknown as string },
          { $set: { lastReminderAt: new Date().toISOString() } },
        );
      reminded += 1;
    }
  }
  return reminded;
}
