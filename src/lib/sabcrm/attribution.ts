/**
 * SabCRM — marketing attribution — PURE model math (no I/O, no `server-only`).
 *
 * The structural twin of `./scoring.ts`: a deterministic, I/O-free module so the
 * unit tests (`tsx --test`) AND the `'use client'` report page can import the
 * attribution types + the credit-allocation math directly. The Mongo side
 * effects (recording touches, reading won deals, the SabSense emit) live in
 * `./attribution.server.ts`, which re-exports everything here.
 *
 * ## Model
 *
 * Every record (a deal / opportunity) accrues a **touch history** — an ordered
 * list of {@link Touch}es, each a marketing interaction (a source, optionally a
 * campaign + medium, at a timestamp). When a deal is **won**, its revenue is
 * distributed across the channels that contributed to it according to an
 * {@link AttributionModel}:
 *
 *   - `first` — 100% of the revenue credited to the FIRST touch.
 *   - `last`  — 100% credited to the LAST touch.
 *   - `linear`— revenue split EQUALLY across every touch.
 *
 * A deal with no recorded touches falls back to a synthetic `(direct)` touch so
 * its revenue is never silently dropped from the totals.
 *
 * The output is a {@link CampaignRollup}: revenue + deal counts grouped by
 * `source` and by `source › campaign`, ranked highest-revenue first — exactly
 * what the report page renders.
 */

/** The three classic single-/multi-touch attribution models. */
export type AttributionModel = 'first' | 'last' | 'linear';

export const ATTRIBUTION_MODELS: ReadonlyArray<AttributionModel> = [
  'first',
  'last',
  'linear',
];

/** A single marketing touch on a record's history. */
export interface Touch {
  /** Channel / source, e.g. `google`, `linkedin`, `referral`. */
  source: string;
  /** Optional campaign name, e.g. `q2-webinar`. */
  campaign?: string;
  /** Optional medium, e.g. `cpc`, `organic`, `email`. */
  medium?: string;
  /** ISO timestamp the touch occurred (used to order the history). */
  at: string;
}

/** A won deal's revenue + its ordered touch history (the report input row). */
export interface AttributableDeal {
  /** Record id (for de-dup / debugging; not used by the math). */
  recordId: string;
  /** The deal's won revenue (already coerced to a plain number). */
  revenue: number;
  /** The deal's touch history (any order; sorted internally by `at`). */
  touches: Touch[];
}

/** One row of the rollup: a channel and its attributed revenue + deal count. */
export interface AttributionRow {
  /** Grouping key (`source` or `source › campaign`). */
  key: string;
  source: string;
  /** Present only on per-campaign rows. */
  campaign?: string;
  /** Sum of attributed revenue across all deals. */
  revenue: number;
  /**
   * Fractional deal count — a deal split across N channels under `linear`
   * contributes `1/N` to each. Rounded for display by the caller.
   */
  deals: number;
}

/** The full attribution rollup returned by {@link buildAttributionReport}. */
export interface CampaignRollup {
  model: AttributionModel;
  /** Total won revenue across all deals (model-independent). */
  totalRevenue: number;
  /** Number of won deals considered. */
  totalDeals: number;
  /** Revenue attributed by source (highest revenue first). */
  bySource: AttributionRow[];
  /** Revenue attributed by source › campaign (highest revenue first). */
  byCampaign: AttributionRow[];
}

/** The placeholder source used when a won deal has no recorded touches. */
export const DIRECT_SOURCE = '(direct)';
/** The placeholder campaign used when a touch has no campaign. */
export const NONE_CAMPAIGN = '(none)';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Numeric, finite, non-negative coercion (NaN / negatives → 0). */
function safeRevenue(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Normalize a source label; blank → {@link DIRECT_SOURCE}. */
function normSource(s: unknown): string {
  const t = typeof s === 'string' ? s.trim() : '';
  return t || DIRECT_SOURCE;
}

/** Normalize a campaign label; blank → {@link NONE_CAMPAIGN}. */
function normCampaign(c: unknown): string {
  const t = typeof c === 'string' ? c.trim() : '';
  return t || NONE_CAMPAIGN;
}

/**
 * Sort a touch history chronologically (ascending by `at`). Stable: touches
 * with equal / unparseable timestamps keep their input order. Returns a NEW
 * array — never mutates the caller's.
 */
export function sortTouches(touches: Touch[]): Touch[] {
  return touches
    .map((t, i) => ({ t, i, ts: Date.parse(t?.at ?? '') }))
    .sort((a, b) => {
      const at = Number.isFinite(a.ts) ? a.ts : 0;
      const bt = Number.isFinite(b.ts) ? b.ts : 0;
      return at === bt ? a.i - b.i : at - bt;
    })
    .map((x) => x.t);
}

/**
 * The list of touches that receive credit for a deal under `model`, plus the
 * EQUAL weight each one gets (weights sum to 1). Pure + deterministic.
 *
 *   - `first`  → the earliest touch, weight 1.
 *   - `last`   → the latest touch, weight 1.
 *   - `linear` → every touch, weight `1/N`.
 *
 * An empty history yields a single synthetic `(direct)` touch with weight 1, so
 * the deal's revenue is always attributed somewhere.
 */
export function creditedTouches(
  touches: Touch[],
  model: AttributionModel,
): Array<{ touch: Touch; weight: number }> {
  const sorted = sortTouches(Array.isArray(touches) ? touches : []);
  if (sorted.length === 0) {
    return [{ touch: { source: DIRECT_SOURCE, at: '' }, weight: 1 }];
  }
  switch (model) {
    case 'first':
      return [{ touch: sorted[0], weight: 1 }];
    case 'last':
      return [{ touch: sorted[sorted.length - 1], weight: 1 }];
    case 'linear': {
      const w = 1 / sorted.length;
      return sorted.map((touch) => ({ touch, weight: w }));
    }
    default:
      return [{ touch: sorted[0], weight: 1 }];
  }
}

/** Sum two rows' revenue + deals into the accumulator map keyed by `key`. */
function accumulate(
  map: Map<string, AttributionRow>,
  key: string,
  base: Omit<AttributionRow, 'revenue' | 'deals'>,
  revenue: number,
  deals: number,
): void {
  const existing = map.get(key);
  if (existing) {
    existing.revenue += revenue;
    existing.deals += deals;
  } else {
    map.set(key, { ...base, revenue, deals });
  }
}

/** Sort rows highest-revenue first, ties broken by key for determinism. */
function rankRows(map: Map<string, AttributionRow>): AttributionRow[] {
  return [...map.values()].sort(
    (a, b) => b.revenue - a.revenue || a.key.localeCompare(b.key),
  );
}

/* -------------------------------------------------------------------------- */
/* Single-deal attribution                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Attribute ONE deal's revenue across its touches under `model`. Returns a flat
 * list of `(source, campaign, revenue, deals)` slices whose `revenue` sums to
 * the deal's revenue and whose `deals` sum to 1. Pure.
 */
export function attributeDeal(
  deal: AttributableDeal,
  model: AttributionModel,
): AttributionRow[] {
  const revenue = safeRevenue(deal?.revenue);
  const credited = creditedTouches(deal?.touches ?? [], model);
  return credited.map(({ touch, weight }) => {
    const source = normSource(touch.source);
    const campaign = normCampaign(touch.campaign);
    return {
      key: `${source}›${campaign}`,
      source,
      campaign,
      revenue: revenue * weight,
      deals: weight,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Rollup                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Roll a set of won deals up into a {@link CampaignRollup} under `model`:
 * revenue + (fractional) deal counts grouped by source and by source › campaign,
 * ranked highest-revenue first. Pure + deterministic — the heart of the report.
 */
export function buildCampaignRollup(
  deals: AttributableDeal[],
  model: AttributionModel,
): CampaignRollup {
  const bySource = new Map<string, AttributionRow>();
  const byCampaign = new Map<string, AttributionRow>();
  let totalRevenue = 0;
  let totalDeals = 0;

  for (const deal of Array.isArray(deals) ? deals : []) {
    totalRevenue += safeRevenue(deal?.revenue);
    totalDeals += 1;
    for (const slice of attributeDeal(deal, model)) {
      accumulate(
        bySource,
        slice.source,
        { key: slice.source, source: slice.source },
        slice.revenue,
        slice.deals,
      );
      accumulate(
        byCampaign,
        slice.key,
        { key: slice.key, source: slice.source, campaign: slice.campaign },
        slice.revenue,
        slice.deals,
      );
    }
  }

  return {
    model,
    totalRevenue,
    totalDeals,
    bySource: rankRows(bySource),
    byCampaign: rankRows(byCampaign),
  };
}
