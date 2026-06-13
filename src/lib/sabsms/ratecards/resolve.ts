/**
 * SabSMS reseller rate cards — pure resolution (V2.13).
 *
 * A rate card belongs to a RESELLER workspace and prices its child
 * workspaces: `rates` rows are (country, channel?, category?) →
 * creditsPerSegment. Architecture decision 10 made price a *data*
 * lookup since V2.0 (`creditCostFor` takes an injectable table) — this
 * module supplies the per-workspace layer on top, with fallback to the
 * platform default table.
 *
 * Resolution precedence (documented + unit-tested):
 *
 *   1. Card pick: among cards listing the workspace in
 *      `childWorkspaceIds` with `effectiveFrom <= now`, the LATEST
 *      `effectiveFrom` wins (future cards are staged, not active).
 *   2. Rate pick within the card: a row matches when its country equals
 *      the destination (or the row's country is '*'), its channel is
 *      absent or equal, and its category is absent or equal. The MOST
 *      SPECIFIC matching row wins (exact country > '*'; then more
 *      filled-in fields beat fewer; ties → first row).
 *   3. No matching row (or no card) → the default platform table
 *      ([`creditCostFor`]).
 *
 * Semantics: `creditsPerSegment` is per SMS/MMS segment; RCS is flat
 * per message (segments don't apply), matching the default table.
 *
 * Pure + test-safe: no Mongo, no `server-only`.
 */

import { creditCostFor, type CreditCostInput } from '../credits/rates';
import type { SabsmsChannel, SabsmsMessageCategory } from '../types';

export interface SabsmsRateCardRate {
  /** ISO 3166-1 alpha-2 ("IN", "US") or '*' for any country. */
  country: string;
  /** Absent = any channel. */
  channel?: SabsmsChannel;
  /** Absent = any category. */
  category?: SabsmsMessageCategory;
  creditsPerSegment: number;
}

export interface SabsmsRateCardLike {
  /** The RESELLER workspace that owns this card. */
  workspaceId: string;
  name: string;
  rates: SabsmsRateCardRate[];
  /** Workspaces priced by this card. */
  childWorkspaceIds: string[];
  marginNote?: string;
  effectiveFrom: Date;
  createdAt: Date;
}

/**
 * Pick the card governing `childWorkspaceId` at `now`: latest
 * `effectiveFrom <= now` among cards listing the workspace as a child.
 */
export function pickRateCard<T extends SabsmsRateCardLike>(
  cards: readonly T[],
  childWorkspaceId: string,
  now: Date = new Date(),
): T | null {
  let best: T | null = null;
  for (const card of cards) {
    if (!card.childWorkspaceIds?.includes(childWorkspaceId)) continue;
    const from = card.effectiveFrom instanceof Date ? card.effectiveFrom : new Date(card.effectiveFrom);
    if (Number.isNaN(from.getTime()) || from.getTime() > now.getTime()) continue;
    if (!best || from.getTime() > best.effectiveFrom.getTime()) best = card;
  }
  return best;
}

interface RateMatchInput {
  destinationCountry: string;
  channel: SabsmsChannel;
  category?: SabsmsMessageCategory;
}

/**
 * Most-specific matching rate row, or null. Specificity score:
 * exact-country match (4) beats '*' (0); +2 for a channel match
 * constraint, +1 for a category match constraint.
 */
export function matchRate(
  rates: readonly SabsmsRateCardRate[] | undefined,
  input: RateMatchInput,
): SabsmsRateCardRate | null {
  if (!rates || rates.length === 0) return null;
  const country = (input.destinationCountry ?? '').trim().toUpperCase();

  let best: SabsmsRateCardRate | null = null;
  let bestScore = -1;
  for (const rate of rates) {
    const rateCountry = (rate.country ?? '').trim().toUpperCase();
    let score = 0;
    if (rateCountry === '*') {
      score += 0;
    } else if (rateCountry === country && country !== '') {
      score += 4;
    } else {
      continue;
    }
    if (rate.channel !== undefined) {
      if (rate.channel !== input.channel) continue;
      score += 2;
    }
    if (rate.category !== undefined) {
      if (!input.category || rate.category !== input.category) continue;
      score += 1;
    }
    const perSegment = Number(rate.creditsPerSegment);
    if (!Number.isFinite(perSegment) || perSegment <= 0) continue;
    if (score > bestScore) {
      best = rate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Credit cost under a (possibly null) rate card, falling back to the
 * default table when no row matches. Mirrors `creditCostFor`'s
 * semantics: integer credits, MMS = segments × rate (the card rate IS
 * the MMS rate when a channel-specific row matched; otherwise the
 * generic per-segment rate applies without the default 3× multiplier —
 * resellers price channels explicitly), RCS = flat per message.
 */
export function creditCostWithCard(
  card: SabsmsRateCardLike | null,
  input: CreditCostInput,
): number {
  if (card) {
    const rate = matchRate(card.rates, {
      destinationCountry: input.destinationCountry,
      channel: input.channel,
      category: input.category,
    });
    if (rate) {
      if (input.channel === 'rcs') {
        return Math.max(1, Math.ceil(rate.creditsPerSegment));
      }
      const segments = Math.max(1, Math.floor(Number(input.segments) || 1));
      return Math.max(1, Math.ceil(rate.creditsPerSegment * segments));
    }
  }
  return creditCostFor(input);
}
