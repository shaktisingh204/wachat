/**
 * SabCRM — CPQ pricing waterfall — PURE evaluator helpers.
 *
 * The structural twin of `./finance-doc-math.ts`: a `'server-only'`- and
 * I/O-free module so the unit tests (`tsx --test`) AND the `'use client'`
 * settings page / the quotation form can import the types + the deterministic
 * pricing math directly. The Mongo / price-book persistence + the
 * discount-approval flow live in `./pricing.server.ts`, which re-exports
 * everything here.
 *
 * ## What a CPQ waterfall does
 *
 * A "price waterfall" walks a quote line through an ordered chain of price
 * adjustments, recording each STEP so the rep (and an auditor) can see exactly
 * why the line landed where it did. The chain here, per line, is:
 *
 *   1. **List price** — the catalog/price-book unit price (the starting point).
 *   2. **Volume / tier discount** — the price-book's quantity tiers knock a %
 *      off list once `qty` crosses a threshold (only the single best matching
 *      tier applies, never stacked).
 *   3. **Manual discount** — the rep's per-line `discountPct` (capped at 100).
 *   4. **Tax** — `taxRatePct` applied to the post-discount taxable base.
 *
 * The result is a per-line breakdown + document totals + the applied-step
 * TRACE (one {@link WaterfallStep} per adjustment that actually moved the
 * number), all rounded 2-dp via the SAME `round2`/`safeNum` helpers the finance
 * doc-math uses — so a CPQ-priced quote and a hand-built quotation can never
 * drift, and floating-point dust never reaches the wire or the UI.
 *
 * `needsDiscountApproval` decides whether the resolved effective discount on a
 * quote breaches the project's approval threshold (config in
 * `./pricing.server.ts`).
 */

import {
  round2,
  safeNum,
  signedNum,
  type DocLineInput,
} from './finance-doc-math';

/* -------------------------------------------------------------------------- */
/* Price book + rules model                                                    */
/* -------------------------------------------------------------------------- */

/** One quantity tier on a price-book entry: `qty >= minQty` ⇒ `discountPct`. */
export interface PriceTier {
  /** Inclusive lower quantity bound (the tier applies once qty reaches it). */
  minQty: number;
  /** Volume discount % (0–100) granted at this tier. */
  discountPct: number;
  /** Optional human label shown in the editor + the step trace. */
  label?: string;
}

/** One price-book line: a catalog item's list price + its volume tiers. */
export interface PriceBookEntry {
  /** Catalog item id (24-char hex) this entry prices. */
  itemId: string;
  /** Optional cached label (so the editor never renders a bare id). */
  itemLabel?: string;
  /** List/unit price (per `qty`) — the waterfall's starting point. */
  listPrice: number;
  /** Volume tiers (any order; the engine picks the single best match). */
  tiers?: PriceTier[];
}

/** A persisted price book (the doc shape minus the Mongo `_id`). */
export interface PriceBook {
  id: string;
  projectId: string;
  name: string;
  /** ISO 4217, e.g. `INR` / `USD`. Informational; math is currency-agnostic. */
  currency: string;
  enabled: boolean;
  entries: PriceBookEntry[];
  /** Default per-project discount-approval threshold % (0–100). */
  thresholdPct: number;
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by the save action (server stamps id / timestamps / project). */
export interface PriceBookInput {
  /** Present → update; absent → insert. */
  id?: string;
  name: string;
  currency?: string;
  enabled?: boolean;
  entries: PriceBookEntry[];
  thresholdPct?: number;
}

/**
 * The knobs the waterfall obeys beyond the price book. All optional so a quote
 * priced with nothing but a price book still gets list price + tax.
 */
export interface PricingRules {
  /**
   * Hard cap on the COMBINED effective discount % (volume + manual) per line,
   * 0–100. A line whose discounts would exceed it is clamped to the cap and the
   * trace records the clamp. `undefined` = no cap.
   */
  maxDiscountPct?: number;
  /** When true, ignore the price book's volume tiers (manual discount only). */
  ignoreVolumeTiers?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Waterfall output model                                                      */
/* -------------------------------------------------------------------------- */

/** Every recognised waterfall step kind (drives the trace icon/label). */
export type WaterfallStepKind =
  | 'list'
  | 'volume'
  | 'manual'
  | 'cap'
  | 'tax';

/** One applied step in a line's waterfall (only steps that MOVED the number). */
export interface WaterfallStep {
  kind: WaterfallStepKind;
  /** Human label, e.g. `"Volume tier ≥ 10"` or `"Manual discount 5%"`. */
  label: string;
  /** The amount this step subtracted (discount) or added (tax), signed. */
  amount: number;
  /** Running per-unit (or taxable) value AFTER this step, for the breakdown. */
  runningTotal: number;
  /** The % this step represented, when it was a percentage adjustment. */
  pct?: number;
}

/** A fully-priced quote line. */
export interface PricedLine {
  itemId?: string;
  description?: string;
  hsnSac?: string;
  unit?: string;
  qty: number;
  /** Effective unit price BEFORE the waterfall (price-book list or the row rate). */
  listPrice: number;
  /** `qty × listPrice`. */
  gross: number;
  /** Volume discount amount (price-book tiers). */
  volumeDiscount: number;
  /** Manual (rep) discount amount. */
  manualDiscount: number;
  /** Total discount actually applied (after any cap). */
  discount: number;
  /** The combined effective discount %, 0–100 (against `gross`). */
  discountPct: number;
  /** Taxable base (`gross − discount`). */
  taxable: number;
  /** Tax amount (`taxable × taxRatePct / 100`). */
  tax: number;
  /** Tax % applied. */
  taxRatePct: number;
  /** `taxable + tax`. */
  total: number;
  /** The applied-step trace, in waterfall order. */
  steps: WaterfallStep[];
}

/** Document-level rollup of a priced quote. */
export interface PricedTotals {
  lines: PricedLine[];
  /** Σ gross (pre-discount, pre-tax). */
  grossTotal: number;
  /** Σ discount (volume + manual, post-cap). */
  discountTotal: number;
  /** Σ taxable — pre-tax, post-discount. */
  subTotal: number;
  /** Σ tax. */
  taxTotal: number;
  /** subTotal + taxTotal. */
  total: number;
  /** Blended effective discount % across the whole quote (vs grossTotal). */
  effectiveDiscountPct: number;
}

/** One line going INTO the waterfall (a quote draft line). */
export interface QuoteLineInput extends DocLineInput {
  /** Cached label, round-tripped into the priced line for display. */
  itemLabel?: string;
}

/* -------------------------------------------------------------------------- */
/* Price-book lookup                                                           */
/* -------------------------------------------------------------------------- */

/** The price-book entry for an item id, or null. Pure. */
export function findPriceBookEntry(
  priceBook: Pick<PriceBook, 'entries'> | null | undefined,
  itemId: string | undefined,
): PriceBookEntry | null {
  if (!priceBook || !itemId) return null;
  for (const e of priceBook.entries ?? []) {
    if (e?.itemId === itemId) return e;
  }
  return null;
}

/**
 * The single BEST volume tier for a quantity (highest `minQty` the qty
 * reaches), or null. Tiers never stack — the rep gets exactly the one tier they
 * qualified for. Pure.
 */
export function bestVolumeTier(
  tiers: PriceTier[] | undefined,
  qty: number,
): PriceTier | null {
  if (!tiers || tiers.length === 0) return null;
  const q = safeNum(qty);
  let best: PriceTier | null = null;
  for (const t of tiers) {
    if (!t) continue;
    const min = safeNum(t.minQty);
    if (q >= min && (best === null || min > safeNum(best.minQty))) best = t;
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/* The waterfall                                                               */
/* -------------------------------------------------------------------------- */

/** Clamp a percentage into [0, 100]. */
function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * Price ONE line through the full waterfall. The line's `rate` is used as the
 * list price ONLY when the price book carries no entry for the item — so a
 * price-book item always wins over a stale typed rate, and a free-text row
 * still prices off whatever the rep typed.
 *
 * Pure + deterministic; all money 2-dp.
 */
export function priceLine(
  line: QuoteLineInput,
  priceBook: Pick<PriceBook, 'entries'> | null | undefined,
  rules: PricingRules = {},
): PricedLine {
  const qty = safeNum(line.qty);
  const entry = findPriceBookEntry(priceBook, line.itemId);

  // 1. LIST PRICE — price-book list price wins; else the typed rate.
  const listPrice = round2(
    entry ? safeNum(entry.listPrice) : safeNum(line.rate),
  );
  const gross = round2(qty * listPrice);

  const steps: WaterfallStep[] = [
    {
      kind: 'list',
      label: entry
        ? `List price (${entry.itemLabel || 'price book'})`
        : 'List price',
      amount: gross,
      runningTotal: gross,
    },
  ];

  // 2. VOLUME / TIER DISCOUNT — single best price-book tier (unless suppressed).
  let volumePct = 0;
  if (!rules.ignoreVolumeTiers && entry) {
    const tier = bestVolumeTier(entry.tiers, qty);
    if (tier) volumePct = clampPct(safeNum(tier.discountPct));
  }

  // 3. MANUAL DISCOUNT — the rep's per-line %, additive with volume.
  const manualPct = clampPct(safeNum(line.discountPct));

  // Combined effective discount %, then the optional hard cap.
  let effPct = clampPct(volumePct + manualPct);
  const cap =
    rules.maxDiscountPct === undefined
      ? undefined
      : clampPct(safeNum(rules.maxDiscountPct));
  const capped = cap !== undefined && effPct > cap;
  if (capped && cap !== undefined) effPct = cap;

  // Apportion the (possibly capped) effective % back to volume vs manual so the
  // per-component amounts in the breakdown sum to the applied discount exactly.
  const requested = volumePct + manualPct;
  const scale = requested > 0 ? effPct / requested : 0;
  const appliedVolumePct = volumePct * scale;
  const appliedManualPct = manualPct * scale;

  const volumeDiscount = round2((gross * appliedVolumePct) / 100);
  const manualDiscount = round2((gross * appliedManualPct) / 100);
  const discount = round2((gross * effPct) / 100);

  let running = gross;
  if (volumeDiscount > 0) {
    running = round2(running - volumeDiscount);
    steps.push({
      kind: 'volume',
      label: `Volume discount ${round2(appliedVolumePct)}%`,
      amount: -volumeDiscount,
      runningTotal: running,
      pct: round2(appliedVolumePct),
    });
  }
  if (manualDiscount > 0) {
    running = round2(running - manualDiscount);
    steps.push({
      kind: 'manual',
      label: `Manual discount ${round2(appliedManualPct)}%`,
      amount: -manualDiscount,
      runningTotal: running,
      pct: round2(appliedManualPct),
    });
  }
  if (capped && cap !== undefined) {
    steps.push({
      kind: 'cap',
      label: `Capped at ${round2(cap)}% max discount`,
      amount: 0,
      runningTotal: running,
      pct: round2(cap),
    });
  }

  const taxable = round2(gross - discount);

  // 4. TAX — on the post-discount taxable base.
  const taxRatePct = safeNum(line.taxRatePct);
  const tax = round2((taxable * taxRatePct) / 100);
  if (tax > 0) {
    running = round2(taxable + tax);
    steps.push({
      kind: 'tax',
      label: `Tax ${round2(taxRatePct)}%`,
      amount: tax,
      runningTotal: running,
      pct: round2(taxRatePct),
    });
  }

  return {
    itemId: line.itemId,
    description: line.description,
    hsnSac: line.hsnSac,
    unit: line.unit,
    qty,
    listPrice,
    gross,
    volumeDiscount,
    manualDiscount,
    discount,
    discountPct: round2(effPct),
    taxable,
    tax,
    taxRatePct: round2(taxRatePct),
    total: round2(taxable + tax),
    steps,
  };
}

/**
 * Run the full pricing waterfall over a set of quote lines, returning the
 * per-line breakdown + the document totals + each line's applied-step trace.
 *
 * THE single source of truth for CPQ pricing — the quotation form's live
 * preview and the server's `computeQuotePricing` recompute both call this, so
 * they can never disagree (the same contract `finance-doc-math` provides for
 * hand-built docs). Pure; no I/O.
 */
export function priceWaterfall(
  lineItems: QuoteLineInput[],
  priceBook: Pick<PriceBook, 'entries'> | null | undefined,
  rules: PricingRules = {},
): PricedTotals {
  const lines = (lineItems ?? []).map((l) => priceLine(l, priceBook, rules));

  const grossTotal = round2(lines.reduce((s, l) => s + l.gross, 0));
  const discountTotal = round2(lines.reduce((s, l) => s + l.discount, 0));
  const subTotal = round2(lines.reduce((s, l) => s + l.taxable, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.tax, 0));
  const total = round2(subTotal + taxTotal);
  const effectiveDiscountPct =
    grossTotal > 0 ? round2((discountTotal / grossTotal) * 100) : 0;

  return {
    lines,
    grossTotal,
    discountTotal,
    subTotal,
    taxTotal,
    total,
    effectiveDiscountPct,
  };
}

/* -------------------------------------------------------------------------- */
/* Discount approval gate                                                       */
/* -------------------------------------------------------------------------- */

/** The minimal quote shape `needsDiscountApproval` needs to decide. */
export interface ApprovableQuote {
  /** The quote's priced lines (already run through the waterfall). */
  lines?: QuoteLineInput[];
  /**
   * Pre-computed totals (from {@link priceWaterfall}). When present they win;
   * otherwise the lines are re-priced with no price book so the function stays
   * usable from a thin client that only has the raw lines.
   */
  totals?: Pick<PricedTotals, 'grossTotal' | 'discountTotal'>;
}

/** The verdict of an approval check (mirrors the scoring `ScoreResult` shape). */
export interface DiscountApprovalDecision {
  /** True when the effective discount breaches the threshold. */
  needsApproval: boolean;
  /** The blended effective discount % the quote resolved to. */
  effectiveDiscountPct: number;
  /** The threshold it was compared against. */
  thresholdPct: number;
}

/**
 * Does this quote's effective discount breach the approval threshold?
 *
 * The blended discount % across the whole quote (Σ discount ÷ Σ gross) is
 * compared against `thresholdPct`. A non-positive / non-finite threshold means
 * "every discount needs approval is OFF" → never requires approval. A quote
 * with no gross can never breach. Pure.
 */
export function needsDiscountApproval(
  quote: ApprovableQuote,
  thresholdPct: number,
): DiscountApprovalDecision {
  const threshold = signedNum(thresholdPct);
  let gross: number;
  let discount: number;
  if (quote.totals) {
    gross = safeNum(quote.totals.grossTotal);
    discount = safeNum(quote.totals.discountTotal);
  } else {
    const t = priceWaterfall(quote.lines ?? [], null);
    gross = t.grossTotal;
    discount = t.discountTotal;
  }
  const effectiveDiscountPct =
    gross > 0 ? round2((discount / gross) * 100) : 0;
  const needsApproval =
    threshold > 0 && gross > 0 && effectiveDiscountPct > threshold + 1e-9;
  return {
    needsApproval,
    effectiveDiscountPct,
    thresholdPct: threshold > 0 ? round2(threshold) : 0,
  };
}

export const DEFAULT_DISCOUNT_THRESHOLD_PCT = 15;
