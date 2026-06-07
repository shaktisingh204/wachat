/**
 * Pure statistical helpers for the A/B tests page.
 *
 * Lives in its own module (no `"use server"`, no Mongo / engine imports)
 * so the `node:test` runner can load it without hauling `mongodb` into
 * the boot graph. `actions.ts` re-exports `computeSignificance` and
 * `computeSegmentLifts` so callers don't need to know about the split.
 */

export type AbTestStatus = "running" | "paused" | "completed" | "archived";
export type AbTestKind = "body" | "sender" | "send_time";
export type AbConversionMetric = "ctr" | "reply" | "conversion";
export type AbStatsMode = "frequentist" | "bayesian";

export interface AbVariant {
  id: string;
  label: string;
  /** Total recipients in this arm. */
  total: number;
  /** Successes (CTR clicks / replies / conversions, depending on metric). */
  conversions: number;
  /** Sub-metrics for the per-variant CTR / reply / conversion column. */
  clicks: number;
  replies: number;
  /** Total cost in micro-currency (cents × 10000) — keeps math integer. */
  costMicros: number;
  /** Segment label used for per-segment lift analysis. */
  segment?: string;
}

export interface AbTestRow {
  id: string;
  name: string;
  kind: AbTestKind;
  status: AbTestStatus;
  metric: AbConversionMetric;
  statsMode: AbStatsMode;
  autoPromote: boolean;
  minSample: number;
  /** First variant is the control. */
  variants: AbVariant[];
  /** Optional pinned winner (force-pick). */
  winnerVariantId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  /** Optional small inline simulation series (for Ui20Chart). */
  simulation?: { iter: number; pValue: number }[];
}

export interface SignificanceResult {
  /** Two-sided p-value from a Yates-corrected chi-square 2×2 contingency. */
  pValue: number;
  /** Wilson 95% CI on the variant proportion. */
  ciLow: number;
  ciHigh: number;
  /** True when pValue < 0.05 and both arms have ≥ 30 samples. */
  significant: boolean;
}

/**
 * Compute the two-sided p-value (Yates-corrected chi-square, 1 d.f.) and a
 * Wilson-score 95% CI for the *variant* proportion.
 *
 * Pure function — no I/O, deterministic, side-effect free. Edge cases:
 *  • Either arm has 0 samples → p=1, CI=[0,0], not significant
 *  • Identical proportions → p≈1
 *  • Yates correction applied to keep small-N tests honest
 */
export function computeSignificance(
  controlConversions: number,
  controlTotal: number,
  variantConversions: number,
  variantTotal: number,
): SignificanceResult {
  if (controlTotal <= 0 || variantTotal <= 0) {
    return { pValue: 1, ciLow: 0, ciHigh: 0, significant: false };
  }
  const a = controlConversions;
  const b = controlTotal - controlConversions;
  const c = variantConversions;
  const d = variantTotal - variantConversions;
  const n = a + b + c + d;

  // Yates-corrected chi-square for a 2×2 contingency table.
  const numerator = Math.pow(Math.abs(a * d - b * c) - n / 2, 2) * n;
  const denominator = (a + b) * (c + d) * (a + c) * (b + d);
  const chi2 = denominator === 0 ? 0 : numerator / denominator;

  // Chi-square with 1 d.f. ⇒ p-value via the survival function of the
  // standard normal: p = erfc(sqrt(chi2/2)). The complementary error
  // function is approximated by Abramowitz & Stegun 7.1.26 (max abs err
  // ≈ 1.5e-7 — plenty for "is this significant" decisions).
  const pValue =
    chi2 === 0 ? 1 : Math.min(1, Math.max(0, erfc(Math.sqrt(chi2 / 2))));

  // Wilson 95% interval on the variant proportion (z = 1.96).
  const z = 1.959964;
  const phat = variantConversions / variantTotal;
  const denom = 1 + (z * z) / variantTotal;
  const centre = phat + (z * z) / (2 * variantTotal);
  const margin =
    z *
    Math.sqrt(
      (phat * (1 - phat) + (z * z) / (4 * variantTotal)) / variantTotal,
    );
  const ciLow = Math.max(0, (centre - margin) / denom);
  const ciHigh = Math.min(1, (centre + margin) / denom);

  const significant =
    pValue < 0.05 && controlTotal >= 30 && variantTotal >= 30;

  return {
    pValue: Number(pValue.toFixed(6)),
    ciLow: Number(ciLow.toFixed(6)),
    ciHigh: Number(ciHigh.toFixed(6)),
    significant,
  };
}

// Abramowitz & Stegun 7.1.26 — complementary error function.
function erfc(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax));
  const erf = sign * y;
  return 1 - erf;
}

/**
 * Per-segment lift analysis — splits each variant by `segment`, runs the
 * same chi-square per-segment, returns a flat list ready for a table.
 */
export interface SegmentLift {
  segment: string;
  variantId: string;
  total: number;
  conversions: number;
  lift: number;
  pValue: number;
  significant: boolean;
}

export function computeSegmentLifts(test: AbTestRow): SegmentLift[] {
  if (test.variants.length < 2) return [];
  const control = test.variants[0];
  const ctrlRate = control.total > 0 ? control.conversions / control.total : 0;
  const out: SegmentLift[] = [];
  for (const v of test.variants.slice(1)) {
    const sig = computeSignificance(
      control.conversions,
      control.total,
      v.conversions,
      v.total,
    );
    const rate = v.total > 0 ? v.conversions / v.total : 0;
    const lift = ctrlRate === 0 ? 0 : (rate - ctrlRate) / ctrlRate;
    out.push({
      segment: v.segment ?? "all",
      variantId: v.id,
      total: v.total,
      conversions: v.conversions,
      lift: Number(lift.toFixed(4)),
      pValue: sig.pValue,
      significant: sig.significant,
    });
  }
  return out;
}

/**
 * Tiny driver used to render the significance-simulation graph (feature
 * #17). Re-uses the pure chi-square so we don't need an LLM-quality
 * Monte Carlo — for the page tile the trend (p shrinks as n grows) is
 * what we want, not a precise simulation.
 */
export function simulateSeries(
  total: number,
  pA: number,
  pB: number,
): { iter: number; pValue: number }[] {
  const out: { iter: number; pValue: number }[] = [];
  for (let i = 100; i <= total; i += Math.max(50, Math.floor(total / 20))) {
    const ca = Math.round(i * pA);
    const cb = Math.round(i * pB);
    const sig = computeSignificance(ca, i, cb, i);
    out.push({ iter: i, pValue: sig.pValue });
  }
  return out;
}
