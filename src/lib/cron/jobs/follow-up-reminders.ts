import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { jobStart, pushError, toErrorMessage } from '../utils';

interface DealFollowUpDoc extends Document {
  _id: ObjectId;
  deal_id?: ObjectId | string | null;
  assigned_agent_id?: ObjectId | string | null;
  agent_email?: string | null;
  next_follow_up_date?: Date | string | null;
  status?: string;
  reminder_sent?: boolean;
  note?: string | null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Surface every pending follow-up due within the next 24 hours, queue an
 * email + push notification for the assigned agent, then mark
 * `reminder_sent = true` so we don't re-notify on subsequent runs.
 *
 * NOTE: actual delivery is intentionally a TODO log line — the email /
 * push infrastructure is owned by the integrations agent and will read
 * these queued payloads from `notification_outbox`.
 */
export default async function runFollowUpReminders(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('follow-up-reminders');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let notified = 0;

  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const horizon = new Date(now.getTime() + ONE_DAY_MS);

    const due = await db
      .collection<DealFollowUpDoc>('crm_deal_follow_ups')
      .find({
        status: 'pending',
        reminder_sent: { $ne: true },
        next_follow_up_date: { $lte: horizon },
      })
      .toArray();

    for (const followUp of due) {
      processed++;
      const ref = followUp._id.toHexString();
      try {
        const payload = {
          type: 'crm.deal.follow_up.reminder',
          follow_up_id: followUp._id,
          deal_id: followUp.deal_id ?? null,
          assigned_agent_id: followUp.assigned_agent_id ?? null,
          agent_email: followUp.agent_email ?? null,
          next_follow_up_date: followUp.next_follow_up_date ?? null,
          note: followUp.note ?? null,
        };

        // TODO: send email/push — handled by integrations agent.
        log('queue notification', payload);

        await db.collection<DealFollowUpDoc>('crm_deal_follow_ups').updateOne(
          { _id: followUp._id, reminder_sent: { $ne: true } },
          {
            $set: {
              reminder_sent: true,
              reminder_sent_at: new Date(),
              updatedAt: new Date(),
            },
          },
        );
        notified++;
      } catch (err) {
        pushError(errors, err, ref);
        log('error', { ref, message: toErrorMessage(err) });
      }
    }
  } catch (err) {
    pushError(errors, err);
    log('fatal', { message: toErrorMessage(err) });
  }

  const durationMs = Date.now() - startedAt.getTime();
  log('end', { processed, notified, errors: errors.length, durationMs });
  return {
    processed,
    errors,
    durationMs,
    details: { notified },
  };
}
