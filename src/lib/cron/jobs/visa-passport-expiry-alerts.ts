import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { jobStart, pushError, toErrorMessage } from '../utils';

interface ExpiryDoc extends Document {
  _id: ObjectId;
  employee_id?: ObjectId | string | null;
  employee_email?: string | null;
  hr_email?: string | null;
  expiry_date?: Date | string | null;
  alert_before_months?: number | null;
  alert_sent?: boolean;
  document_number?: string | null;
  country?: string | null;
}

interface AlertContext {
  collection: 'visa_details' | 'passports';
  kind: 'visa' | 'passport';
}

const TARGETS: AlertContext[] = [
  { collection: 'visa_details', kind: 'visa' },
  { collection: 'passports', kind: 'passport' },
];

function monthsFromNow(months: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Walk `visa_details` and `passports`, raise expiry alerts for any doc
 * whose `expiry_date` is within `alert_before_months` from today, and
 * flip `alert_sent` so we don't fire twice.
 *
 * Email delivery is logged as TODO for the integrations agent.
 */
export default async function runVisaPassportExpiryAlerts(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('visa-passport-expiry-alerts');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let alerted = 0;

  try {
    const { db } = await connectToDatabase();

    for (const target of TARGETS) {
      // Pull anything with an expiry within the next 12 months — we'll
      // filter by per-doc `alert_before_months` in memory because the
      // window is stored alongside each row.
      const candidates = await db
        .collection<ExpiryDoc>(target.collection)
        .find({
          alert_sent: { $ne: true },
          expiry_date: { $lte: monthsFromNow(12) },
        })
        .toArray();

      for (const doc of candidates) {
        processed++;
        const ref = doc._id.toHexString();
        try {
          if (!doc.expiry_date) continue;
          const expiry =
            doc.expiry_date instanceof Date
              ? doc.expiry_date
              : new Date(doc.expiry_date);
          if (Number.isNaN(expiry.getTime())) continue;

          const months = doc.alert_before_months ?? 3;
          const threshold = new Date(expiry.getTime());
          threshold.setUTCMonth(threshold.getUTCMonth() - months);
          if (threshold.getTime() > Date.now()) continue;

          const payload = {
            type: `hrm.${target.kind}.expiry.alert`,
            document_id: doc._id,
            employee_id: doc.employee_id ?? null,
            employee_email: doc.employee_email ?? null,
            hr_email: doc.hr_email ?? null,
            expiry_date: expiry,
            document_number: doc.document_number ?? null,
            country: doc.country ?? null,
          };

          // TODO: send email — handled by integrations agent.
          log('queue notification', payload);

          await db.collection<ExpiryDoc>(target.collection).updateOne(
            { _id: doc._id, alert_sent: { $ne: true } },
            {
              $set: {
                alert_sent: true,
                alert_sent_at: new Date(),
                updatedAt: new Date(),
              },
            },
          );
          alerted++;
        } catch (err) {
          pushError(errors, err, `${target.kind}:${ref}`);
          log('error', { ref, kind: target.kind, message: toErrorMessage(err) });
        }
      }
    }
  } catch (err) {
    pushError(errors, err);
    log('fatal', { message: toErrorMessage(err) });
  }

  const durationMs = Date.now() - startedAt.getTime();
  log('end', { processed, alerted, errors: errors.length, durationMs });
  return {
    processed,
    errors,
    durationMs,
    details: { alerted },
  };
}
