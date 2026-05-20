import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { addRepeat, jobStart, pushError, toErrorMessage } from '../utils';

interface RecurringEventDoc extends Document {
  _id: ObjectId;
  parent_id?: ObjectId | null;
  repeat?: string;
  repeat_type?: string;
  repeat_every?: number;
  repeat_cycles?: number;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  start_time?: string | null;
  end_time?: string | null;
  title?: string;
  description?: string;
  account_id?: ObjectId | string | null;
  user_id?: ObjectId | string | null;
  status?: string;
}

const RECURRENCE_HORIZON_MS = 1000 * 60 * 60 * 24 * 90; // generate up to 90 days ahead

/**
 * For every parent event marked `repeat === 'yes'`, fill in any missing
 * child instances up to `repeat_cycles` (or up to the 90-day horizon).
 * Children point back via `parent_id`.
 */
export default async function runRecurringEvents(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('recurring-events');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let createdTotal = 0;

  try {
    const { db } = await connectToDatabase();
    const horizon = new Date(Date.now() + RECURRENCE_HORIZON_MS);

    const parents = await db
      .collection<RecurringEventDoc>('crm_events')
      .find({
        repeat: 'yes',
        repeat_cycles: { $gt: 0 },
        $or: [{ parent_id: { $exists: false } }, { parent_id: null }],
      })
      .toArray();

    for (const parent of parents) {
      processed++;
      const ref = parent._id.toHexString();
      try {
        const totalCycles = parent.repeat_cycles ?? 0;
        const existing = await db
          .collection<RecurringEventDoc>('crm_events')
          .countDocuments({ parent_id: parent._id });

        const needed = totalCycles - existing;
        if (needed <= 0) continue;

        const parentStart =
          parent.start_date instanceof Date
            ? parent.start_date
            : parent.start_date
              ? new Date(parent.start_date)
              : new Date();

        const inserts: RecurringEventDoc[] = [];
        // Start from `existing + 1` to skip already-materialised cycles.
        for (let i = existing + 1; i <= totalCycles; i++) {
          const nextStart = addRepeat(
            parentStart,
            parent.repeat_type ?? 'daily',
            (parent.repeat_every ?? 1) * i,
          );
          if (nextStart > horizon) break;

          const child: RecurringEventDoc = {
            _id: new ObjectId(),
            parent_id: parent._id,
            title: parent.title,
            description: parent.description,
            start_date: nextStart,
            end_date: parent.end_date ?? null,
            start_time: parent.start_time ?? null,
            end_time: parent.end_time ?? null,
            account_id: parent.account_id ?? null,
            user_id: parent.user_id ?? null,
            status: parent.status ?? 'scheduled',
            repeat: 'no',
            repeat_cycles: 0,
          };
          inserts.push(child);
        }

        if (inserts.length > 0) {
          await db
            .collection<RecurringEventDoc>('crm_events')
            .insertMany(inserts);
          createdTotal += inserts.length;
        }
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
  log('end', { processed, createdTotal, errors: errors.length, durationMs });
  return {
    processed,
    errors,
    durationMs,
    details: { createdTotal },
  };
}
