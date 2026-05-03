/**
 * Lightweight A/B testing utilities.
 *
 * - Variant assignment is deterministic (FNV-1a hash on visitor cookie),
 *   so the same visitor always sees the same variant, with no DB lookup.
 * - Statistical significance uses a 2x2 chi-square test, with optional
 *   Yates' continuity correction for small samples. Returns a p-value
 *   approximation suitable for in-product traffic-light dashboards.
 */
import type { AbTestVariant } from './types';

/* ────────────────────────────────────────────────────────────────
 * Hashing — FNV-1a, 32-bit. Stable across runtimes.
 * ──────────────────────────────────────────────────────────────── */

export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned
  return h >>> 0;
}

export type AssignVariantOptions = {
  /** Test identifier — mixed into the hash so different tests assign independently. */
  testId: string;
};

/**
 * Deterministically pick a variant for a visitor. Variant weights are
 * normalized; weights summing to 0 fall back to uniform distribution.
 */
export function assignVariant(
  visitorId: string,
  variants: AbTestVariant[],
  opts: AssignVariantOptions,
): AbTestVariant {
  if (variants.length === 0) {
    throw new Error('assignVariant: at least one variant is required');
  }
  const totalWeight = variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
  const weights = totalWeight > 0
    ? variants.map((v) => Math.max(0, v.weight) / totalWeight)
    : variants.map(() => 1 / variants.length);

  const h = fnv1a(`${opts.testId}::${visitorId}`);
  // Map to [0, 1)
  const r = h / 0x100000000;

  let acc = 0;
  for (let i = 0; i < variants.length; i++) {
    acc += weights[i];
    if (r < acc) return variants[i];
  }
  return variants[variants.length - 1];
}

/* ────────────────────────────────────────────────────────────────
 * Significance — 2-arm chi-square.
 * ──────────────────────────────────────────────────────────────── */

export type SignificanceResult = {
  /** Observed conversion rate per variant. */
  rates: number[];
  /** Lift of variant B over variant A (relative). */
  lift: number;
  /** Chi-square statistic. */
  chiSquare: number;
  /** Approximated two-tailed p-value. */
  pValue: number;
  /** True if pValue < threshold. */
  isSignificant: boolean;
  /** Effective sample size (sum of visitors). */
  sampleSize: number;
};

export type SignificanceOptions = {
  /** p-value threshold for `isSignificant`. Defaults to 0.05. */
  alpha?: number;
  /** Apply Yates' continuity correction for small expected counts. */
  yates?: boolean;
};

/**
 * Compare two variants. Variant order is meaningful: lift is computed as
 * `(rate[1] - rate[0]) / rate[0]`, treating the first as control.
 */
export function chiSquareSignificance(
  control: AbTestVariant,
  treatment: AbTestVariant,
  opts: SignificanceOptions = {},
): SignificanceResult {
  const alpha = opts.alpha ?? 0.05;
  const yates = opts.yates ?? false;

  const a = control.conversions;
  const b = control.visitors - control.conversions;
  const c = treatment.conversions;
  const d = treatment.visitors - treatment.conversions;
  const n = a + b + c + d;

  const rateA = control.visitors > 0 ? a / control.visitors : 0;
  const rateB = treatment.visitors > 0 ? c / treatment.visitors : 0;
  const lift = rateA > 0 ? (rateB - rateA) / rateA : 0;

  if (n === 0 || control.visitors === 0 || treatment.visitors === 0) {
    return {
      rates: [rateA, rateB],
      lift,
      chiSquare: 0,
      pValue: 1,
      isSignificant: false,
      sampleSize: n,
    };
  }

  // 2x2 chi-square. With Yates correction:
  // X^2 = N * (|ad - bc| - N/2)^2 / ((a+b)(c+d)(a+c)(b+d))
  const adbc = Math.abs(a * d - b * c);
  const numeratorBase = yates ? Math.max(0, adbc - n / 2) : adbc;
  const denom = (a + b) * (c + d) * (a + c) * (b + d);
  const chiSquare = denom > 0 ? (n * numeratorBase * numeratorBase) / denom : 0;
  const pValue = chiSquarePValue1df(chiSquare);

  return {
    rates: [rateA, rateB],
    lift,
    chiSquare,
    pValue,
    isSignificant: pValue < alpha,
    sampleSize: n,
  };
}

/**
 * Approximation of the upper-tail p-value of a chi-square distribution
 * with 1 degree of freedom. Uses the relation
 *   P(X^2 > x) = erfc(sqrt(x/2))
 * with a numerical erfc approximation (Abramowitz & Stegun 7.1.26).
 */
export function chiSquarePValue1df(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  return erfc(Math.sqrt(x / 2));
}

function erfc(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  // A&S 7.1.26 — max error ~1.5e-7
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  // erf(x) = sign * y; erfc(x) = 1 - erf(x)
  const erfVal = sign * y;
  return Math.max(0, Math.min(1, 1 - erfVal));
}

/**
 * Convenience builder for a fresh variant record.
 */
export function makeVariant(id: string, label: string, weight = 0.5): AbTestVariant {
  return { id, label, weight, visitors: 0, conversions: 0 };
}

/**
 * Compute weights normalized to sum to 1.
 */
export function normalizeWeights(variants: AbTestVariant[]): number[] {
  const total = variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
  if (total === 0) return variants.map(() => 1 / variants.length);
  return variants.map((v) => Math.max(0, v.weight) / total);
}
