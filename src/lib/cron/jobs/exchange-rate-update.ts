import { type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { jobStart, pushError, toErrorMessage } from '../utils';

interface CurrencyDoc extends Document {
  code?: string;
  iso_code?: string;
  is_cryptocurrency?: boolean;
  exchange_rate?: number;
}

interface OpenErApiResponse {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
}

const RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';

/**
 * Refresh `currencies.exchange_rate` (relative to USD) for every fiat
 * currency. Skips anything flagged `is_cryptocurrency: true`. Uses the
 * keyless open.er-api endpoint and `globalThis.fetch` so we don't add a
 * dependency.
 */
export default async function runExchangeRateUpdate(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('exchange-rate-update');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const res = await fetch(RATE_API_URL, {
      // Bypass any framework-level cache so we always get a live quote.
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(
        `open.er-api responded ${res.status} ${res.statusText}`,
      );
    }
    const body = (await res.json()) as OpenErApiResponse;
    if (body.result !== 'success' || !body.rates) {
      throw new Error(
        `open.er-api returned non-success payload: ${JSON.stringify(body).slice(0, 200)}`,
      );
    }
    const rates = body.rates;

    const { db } = await connectToDatabase();
    const currencies = await db
      .collection<CurrencyDoc>('currencies')
      .find({ is_cryptocurrency: { $ne: true } })
      .toArray();

    for (const currency of currencies) {
      processed++;
      const code = (currency.code ?? currency.iso_code ?? '').toUpperCase();
      if (!code) {
        skipped++;
        continue;
      }
      try {
        const rate = rates[code];
        if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
          skipped++;
          continue;
        }

        await db.collection<CurrencyDoc>('currencies').updateOne(
          { _id: currency._id },
          {
            $set: {
              exchange_rate: rate,
              exchange_rate_base: 'USD',
              exchange_rate_updated_at: new Date(),
              updatedAt: new Date(),
            },
          },
        );
        updated++;
      } catch (err) {
        pushError(errors, err, code);
        log('error', { code, message: toErrorMessage(err) });
      }
    }
  } catch (err) {
    pushError(errors, err);
    log('fatal', { message: toErrorMessage(err) });
  }

  const durationMs = Date.now() - startedAt.getTime();
  log('end', { processed, updated, skipped, errors: errors.length, durationMs });
  return {
    processed,
    errors,
    durationMs,
    details: { updated, skipped },
  };
}
