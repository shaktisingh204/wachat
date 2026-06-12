/**
 * SabSMS smart send (V2.10) — per-contact best-hour math over the
 * identity graph's 24-bucket UTC send-time histogram. Pure statistics
 * (no LLM; histograms beat it — per the plan).
 *
 * Dual delivery design (see `src/app/sabsms/campaigns/actions.ts`):
 *
 *   1. RECIPIENT-LEVEL (forward contract): launch writes an optional
 *      `notBeforeEpochMs` on each `sabsms_campaign_recipients` doc for
 *      contacts with histogram signal. The engine ticker does NOT read
 *      it yet — engine support lands next phase; until then the field
 *      is inert data the engine ignores.
 *
 *   2. CAMPAIGN-LEVEL (works today): when a smart-send campaign has no
 *      explicit schedule, create-time sets `scheduledAt` to the next
 *      occurrence of the WORKSPACE-MEDIAN best hour, which the existing
 *      engine scheduled-campaign ticker already honours.
 *
 * Worker-safe: pure module + one optional Mongo helper; no `server-only`.
 */

import {
  SABSMS_IDENTITIES_COLLECTION,
  type SabsmsIdentityDoc,
} from './graph';

/** Minimum total histogram signal before we trust a best hour. */
export const MIN_HISTOGRAM_SIGNAL = 5;

/** Sends already within ±1h of the best hour go out immediately. */
export const BEST_HOUR_TOLERANCE_HOURS = 1;

type HistogramCarrier = Pick<SabsmsIdentityDoc, 'sendTimeHistogram'>;

function histogramOf(identity: HistogramCarrier | null | undefined): number[] | null {
  const h = identity?.sendTimeHistogram;
  if (!Array.isArray(h) || h.length !== 24) return null;
  return h.map((v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0));
}

/**
 * Argmax of the 24-bucket histogram, or `null` when the total signal is
 * below [`MIN_HISTOGRAM_SIGNAL`] (not enough activity to trust). Ties
 * resolve to the EARLIEST hour (stable, deterministic).
 */
export function bestSendHourUtc(
  identity: HistogramCarrier | null | undefined,
): number | null {
  const h = histogramOf(identity);
  if (!h) return null;
  let total = 0;
  let best = 0;
  for (let hour = 0; hour < 24; hour += 1) {
    total += h[hour];
    if (h[hour] > h[best]) best = hour;
  }
  if (total < MIN_HISTOGRAM_SIGNAL) return null;
  return best;
}

/** Circular hour distance (0-12). */
function circularHourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

/** Epoch ms of the next occurrence (top of hour) of a UTC hour after `now`. */
export function nextOccurrenceUtcMs(hour: number, now: Date): number {
  const next = new Date(now.getTime());
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hour);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime();
}

/**
 * Milliseconds to delay a send so it lands in the contact's best hour:
 * 0 when there's no trustworthy signal OR `now` is already within
 * ±[`BEST_HOUR_TOLERANCE_HOURS`] of the best hour; otherwise the ms
 * until the next top-of-best-hour.
 */
export function smartSendDelayMs(
  identity: HistogramCarrier | null | undefined,
  now: Date,
): number {
  const best = bestSendHourUtc(identity);
  if (best === null) return 0;
  if (circularHourDistance(now.getUTCHours(), best) <= BEST_HOUR_TOLERANCE_HOURS) {
    return 0;
  }
  return Math.max(0, nextOccurrenceUtcMs(best, now) - now.getTime());
}

/**
 * Median best hour across a set of identities (only those with enough
 * signal count). Returns `null` when no identity clears the bar — the
 * caller then leaves the campaign immediate.
 */
export function medianBestHourUtc(
  identities: Array<HistogramCarrier | null | undefined>,
): number | null {
  const hours = identities
    .map((i) => bestSendHourUtc(i))
    .filter((h): h is number => h !== null)
    .sort((a, b) => a - b);
  if (hours.length === 0) return null;
  return hours[Math.floor((hours.length - 1) / 2)];
}

// ─── Mongo helper (campaign create-time median) ───────────────────────────

interface IdentityQueryDbLike {
  collection(name: string): {
    find(
      filter: unknown,
      options?: unknown,
    ): {
      limit(n: number): { toArray(): Promise<unknown[]> };
    };
  };
}

/** Identities sampled for the workspace-median best hour (bounded read). */
export const MEDIAN_SAMPLE_LIMIT = 5_000;

/**
 * Workspace-median best send hour, computed over a bounded sample of
 * the workspace's identities. `null` when the workspace has no
 * histogram signal yet.
 */
export async function workspaceMedianBestHourUtc(
  db: IdentityQueryDbLike,
  workspaceId: string,
): Promise<number | null> {
  const docs = (await db
    .collection(SABSMS_IDENTITIES_COLLECTION)
    .find(
      { workspaceId, sendTimeHistogram: { $exists: true } },
      { projection: { sendTimeHistogram: 1 } },
    )
    .limit(MEDIAN_SAMPLE_LIMIT)
    .toArray()) as Array<Pick<SabsmsIdentityDoc, 'sendTimeHistogram'>>;
  return medianBestHourUtc(docs);
}
