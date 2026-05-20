import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { addRepeat, jobStart, pushError, toErrorMessage } from '../utils';

interface RecurringTaskDoc extends Document {
  _id: ObjectId;
  recurring_task_id?: ObjectId | null;
  repeat?: string;
  repeat_type?: string;
  repeat_every?: number;
  repeat_cycles?: number;
  repeat_count?: number;
  due_date?: Date | string | null;
  title?: string;
  description?: string;
  account_id?: ObjectId | string | null;
  assigned_to?: ObjectId | string | null;
  status?: string;
  priority?: string;
}

/**
 * Materialise the next instance of every recurring task whose counter
 * has not yet caught up to `repeat_cycles`. Children carry
 * `recurring_task_id` pointing back to the parent.
 */
export default async function runRecurringTasks(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('recurring-tasks');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let created = 0;

  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const parents = await db
      .collection<RecurringTaskDoc>('crm_tasks')
      .find({
        repeat: 'yes',
        repeat_cycles: { $gt: 0 },
        $expr: {
          $lt: [
            { $ifNull: ['$repeat_count', 0] },
            { $ifNull: ['$repeat_cycles', 0] },
          ],
        },
        $or: [
          { recurring_task_id: { $exists: false } },
          { recurring_task_id: null },
        ],
      })
      .toArray();

    for (const parent of parents) {
      processed++;
      const ref = parent._id.toHexString();
      try {
        const repeatCount = (parent.repeat_count ?? 0) + 1;

        const baseDue =
          parent.due_date instanceof Date
            ? parent.due_date
            : parent.due_date
              ? new Date(parent.due_date)
              : now;

        const nextDue = addRepeat(
          baseDue,
          parent.repeat_type ?? 'daily',
          (parent.repeat_every ?? 1) * repeatCount,
        );

        const child: RecurringTaskDoc = {
          _id: new ObjectId(),
          recurring_task_id: parent._id,
          title: parent.title,
          description: parent.description,
          due_date: nextDue,
          account_id: parent.account_id ?? null,
          assigned_to: parent.assigned_to ?? null,
          status: 'pending',
          priority: parent.priority ?? 'medium',
          repeat: 'no',
          repeat_count: 0,
        };

        await db.collection<RecurringTaskDoc>('crm_tasks').insertOne(child);
        created++;

        await db
          .collection<RecurringTaskDoc>('crm_tasks')
          .updateOne(
            { _id: parent._id },
            { $set: { repeat_count: repeatCount, updatedAt: new Date() } },
          );
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
  log('end', { processed, created, errors: errors.length, durationMs });
  return {
    processed,
    errors,
    durationMs,
    details: { created },
  };
}
