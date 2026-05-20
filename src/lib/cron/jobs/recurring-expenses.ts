import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { addRecurrence, jobStart, pushError, toErrorMessage } from '../utils';

interface RecurringExpenseDoc extends Document {
  _id: ObjectId;
  status?: string;
  nextRunAt?: Date | null;
  billing_frequency?: string;
  billing_interval?: number;
  billing_cycle?: number;
  cyclesRun?: number;
  template?: Record<string, unknown> | null;
  expense_template?: Record<string, unknown> | null;
  account_id?: ObjectId | string | null;
  user_id?: ObjectId | string | null;
  amount?: number;
  currency?: string;
  category_id?: ObjectId | string | null;
}

/**
 * Generate fresh `crm_expenses` rows from every due `crm_expense_recurrings`
 * template. Mirrors the recurring-invoices flow but writes into the
 * expenses collection.
 */
export default async function runRecurringExpenses(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('recurring-expenses');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let generated = 0;
  let completed = 0;

  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const due = await db
      .collection<RecurringExpenseDoc>('crm_expense_recurrings')
      .find({ status: 'active', nextRunAt: { $lte: now } })
      .toArray();

    for (const recurring of due) {
      processed++;
      const ref = recurring._id.toHexString();
      try {
        const template =
          recurring.template ?? recurring.expense_template ?? {};
        const cyclesRun = (recurring.cyclesRun ?? 0) + 1;
        const totalCycles = recurring.billing_cycle ?? 0;

        const expenseDoc = {
          ...template,
          recurring_expense_id: recurring._id,
          account_id: recurring.account_id ?? null,
          user_id: recurring.user_id ?? null,
          category_id: recurring.category_id ?? null,
          amount: recurring.amount ?? (template as { amount?: number }).amount ?? 0,
          currency:
            recurring.currency ??
            (template as { currency?: string }).currency ??
            'USD',
          status: 'pending',
          generated_by: 'cron:recurring-expenses',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.collection('crm_expenses').insertOne(expenseDoc);
        generated++;

        const baseForNext = recurring.nextRunAt ?? now;
        const nextRunAt = addRecurrence(
          baseForNext,
          recurring.billing_frequency ?? 'monthly',
          recurring.billing_interval ?? 1,
        );

        const shouldComplete =
          totalCycles > 0 && cyclesRun >= totalCycles;

        const update: Record<string, unknown> = {
          cyclesRun,
          updatedAt: new Date(),
        };
        if (shouldComplete) {
          update.status = 'completed';
          update.nextRunAt = null;
          completed++;
        } else {
          update.nextRunAt = nextRunAt;
        }

        await db
          .collection<RecurringExpenseDoc>('crm_expense_recurrings')
          .updateOne({ _id: recurring._id }, { $set: update });
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
  log('end', { processed, generated, completed, errors: errors.length, durationMs });
  return {
    processed,
    errors,
    durationMs,
    details: { generated, completed },
  };
}
