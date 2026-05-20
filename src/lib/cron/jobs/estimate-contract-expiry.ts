import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { jobStart, pushError, toErrorMessage } from '../utils';

interface EstimateDoc extends Document {
  _id: ObjectId;
  valid_till?: Date | string | null;
  status?: string;
  created_by?: ObjectId | string | null;
  creator_email?: string | null;
  estimate_number?: string | null;
  expiry_alert_sent?: boolean;
}

interface ContractDoc extends Document {
  _id: ObjectId;
  end_date?: Date | string | null;
  status?: string;
  created_by?: ObjectId | string | null;
  creator_email?: string | null;
  title?: string | null;
  expiry_alert_sent?: boolean;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Notify creators when:
 *  - an estimate (`status === 'waiting'`) is within 7 days of `valid_till`
 *  - a contract (`status !== 'expired'`) is within 30 days of `end_date`
 *
 * Sets `expiry_alert_sent` so we don't re-notify on every cron tick.
 */
export default async function runEstimateContractExpiry(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('estimate-contract-expiry');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let alerted = 0;

  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const estimateHorizon = new Date(now.getTime() + SEVEN_DAYS_MS);
    const contractHorizon = new Date(now.getTime() + THIRTY_DAYS_MS);

    const estimates = await db
      .collection<EstimateDoc>('crm_estimates')
      .find({
        status: 'waiting',
        expiry_alert_sent: { $ne: true },
        valid_till: { $lte: estimateHorizon },
      })
      .toArray();

    for (const est of estimates) {
      processed++;
      const ref = est._id.toHexString();
      try {
        const payload = {
          type: 'crm.estimate.expiry.alert',
          estimate_id: est._id,
          estimate_number: est.estimate_number ?? null,
          valid_till: est.valid_till ?? null,
          created_by: est.created_by ?? null,
          creator_email: est.creator_email ?? null,
        };
        log('queue notification', payload);

        await db.collection<EstimateDoc>('crm_estimates').updateOne(
          { _id: est._id, expiry_alert_sent: { $ne: true } },
          {
            $set: {
              expiry_alert_sent: true,
              expiry_alert_sent_at: new Date(),
              updatedAt: new Date(),
            },
          },
        );
        alerted++;
      } catch (err) {
        pushError(errors, err, `estimate:${ref}`);
        log('error', { ref, kind: 'estimate', message: toErrorMessage(err) });
      }
    }

    const contracts = await db
      .collection<ContractDoc>('crm_contracts')
      .find({
        status: { $ne: 'expired' },
        expiry_alert_sent: { $ne: true },
        end_date: { $lte: contractHorizon },
      })
      .toArray();

    for (const contract of contracts) {
      processed++;
      const ref = contract._id.toHexString();
      try {
        const payload = {
          type: 'crm.contract.expiry.alert',
          contract_id: contract._id,
          title: contract.title ?? null,
          end_date: contract.end_date ?? null,
          created_by: contract.created_by ?? null,
          creator_email: contract.creator_email ?? null,
        };
        log('queue notification', payload);

        await db.collection<ContractDoc>('crm_contracts').updateOne(
          { _id: contract._id, expiry_alert_sent: { $ne: true } },
          {
            $set: {
              expiry_alert_sent: true,
              expiry_alert_sent_at: new Date(),
              updatedAt: new Date(),
            },
          },
        );
        alerted++;
      } catch (err) {
        pushError(errors, err, `contract:${ref}`);
        log('error', { ref, kind: 'contract', message: toErrorMessage(err) });
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
