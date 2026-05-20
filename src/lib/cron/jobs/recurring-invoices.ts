import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { addRecurrence, jobStart, pushError, toErrorMessage } from '../utils';

interface RecurringInvoiceDoc extends Document {
  _id: ObjectId;
  status?: string;
  nextRunAt?: Date | null;
  billing_frequency?: string;
  billing_interval?: number;
  billing_cycle?: number;
  cyclesRun?: number;
  template?: Record<string, unknown> | null;
  invoice_template?: Record<string, unknown> | null;
  templateData?: Record<string, unknown> | null;
  account_id?: ObjectId | string | null;
  user_id?: ObjectId | string | null;
  customer_id?: ObjectId | string | null;
}

/**
 * Roll forward every active recurring invoice whose `nextRunAt` has fallen
 * due. Creates a fresh `crm_invoices` row from the stored template, bumps
 * the cycle counter, and either schedules the next run or marks the
 * series complete when `billing_cycle` has been reached.
 */
export default async function runRecurringInvoices(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('recurring-invoices');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let generated = 0;
  let completed = 0;

  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const due = await db
      .collection<RecurringInvoiceDoc>('crm_recurring_invoices')
      .find({ status: 'active', nextRunAt: { $lte: now } })
      .toArray();

    for (const recurring of due) {
      processed++;
      const ref = recurring._id.toHexString();
      try {
        const template =
          recurring.template ??
          recurring.invoice_template ??
          recurring.templateData ??
          {};
        const cyclesRun = (recurring.cyclesRun ?? 0) + 1;
        const totalCycles = recurring.billing_cycle ?? 0;

        const invoiceDoc = {
          ...template,
          recurring_invoice_id: recurring._id,
          account_id: recurring.account_id ?? null,
          user_id: recurring.user_id ?? null,
          customer_id: recurring.customer_id ?? null,
          status: 'draft',
          generated_by: 'cron:recurring-invoices',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.collection('crm_invoices').insertOne(invoiceDoc);
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
          .collection<RecurringInvoiceDoc>('crm_recurring_invoices')
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
