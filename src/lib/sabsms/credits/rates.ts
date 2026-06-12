import type { SabsmsChannel, SabsmsMessageCategory } from '../types';

/**
 * SabSMS credit rate card — integer credits per message.
 *
 * Exported as data (not hard-coded branches) so it can be swapped for
 * per-workspace rate cards later without touching the call sites.
 *
 * Current table:
 *   - IN (domestic)         1 credit / segment
 *   - US / CA               1 credit / segment
 *   - everywhere else       2 credits / segment
 *   - MMS                   3× the SMS cost
 *   - RCS                   flat 1 credit / message
 */

export interface SabsmsRateTable {
  /** Credits per SMS segment, keyed by ISO 3166-1 alpha-2 country. */
  perSegmentByCountry: Record<string, number>;
  /** Credits per segment when the country has no explicit entry. */
  defaultPerSegment: number;
  /** Multiplier applied to the SMS cost for MMS. */
  mmsMultiplier: number;
  /** Flat per-message cost for RCS (segments don't apply). */
  rcsFlatPerMessage: number;
}

export const SABSMS_RATE_TABLE: SabsmsRateTable = {
  perSegmentByCountry: {
    IN: 1,
    US: 1,
    CA: 1,
  },
  defaultPerSegment: 2,
  mmsMultiplier: 3,
  rcsFlatPerMessage: 1,
};

export interface CreditCostInput {
  segments: number;
  /** ISO 3166-1 alpha-2 (e.g. "IN", "US"); unknown/empty falls to default. */
  destinationCountry: string;
  channel: SabsmsChannel;
  /** Reserved for category-specific rate cards later — unused in v1. */
  category?: SabsmsMessageCategory;
  /** Override table (per-workspace rate cards later). */
  table?: SabsmsRateTable;
}

/** Integer credit cost for one message. Always >= 1. */
export function creditCostFor(input: CreditCostInput): number {
  const table = input.table ?? SABSMS_RATE_TABLE;

  if (input.channel === 'rcs') {
    return table.rcsFlatPerMessage;
  }

  const segments = Math.max(1, Math.floor(Number(input.segments) || 1));
  const country = (input.destinationCountry ?? '').trim().toUpperCase();
  const perSegment = table.perSegmentByCountry[country] ?? table.defaultPerSegment;

  const smsCost = perSegment * segments;
  return input.channel === 'mms' ? smsCost * table.mmsMultiplier : smsCost;
}
