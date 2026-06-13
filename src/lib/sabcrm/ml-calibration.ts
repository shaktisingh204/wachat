/**
 * SabCRM — probability calibration + explainability — PURE (in-house ML).
 *
 * `'server-only'`- and I/O-free (unit-testable). A raw logistic-regression
 * score (`./ml-logreg.ts` `predictProba`) is rarely well-calibrated: a model
 * may say "0.8" for cohorts that actually win 60 % of the time. This module
 * post-processes those raw scores into *calibrated* probabilities, measures how
 * trustworthy they are, and explains an individual prediction — all in pure
 * TypeScript so it runs in-process with the rest of the predictive stack.
 *
 *  - {@link plattScaling} fits a 1-D logistic `sigmoid(a*s + b)` on a holdout
 *    (Platt 1999) so raw scores map to honest probabilities.
 *  - {@link isotonicRegression} fits a non-parametric, monotone step function
 *    (pool-adjacent-violators) — strictly stronger than Platt when the
 *    mis-calibration isn't sigmoidal, at the cost of needing more data.
 *  - {@link brierScore} / {@link reliabilityBins} quantify calibration quality.
 *  - {@link featureContributions} gives a logistic "SHAP-like" decomposition of
 *    one prediction (`w_i * x_i` in standardized space) so the UI can show the
 *    top positive / negative drivers behind a win-probability.
 *
 * Nothing here touches Mongo, the network, or any provider SDK.
 */

import { sigmoid } from './ml-logreg';

/* -------------------------------------------------------------------------- */
/* Platt scaling                                                              */
/* -------------------------------------------------------------------------- */

/** A fitted Platt map: `p = sigmoid(a * rawScore + b)`. */
export interface PlattParams {
  a: number;
  b: number;
}

/** Clamp a probability away from the 0/1 boundary for stable log-loss. */
function clampP(p: number): number {
  const eps = 1e-12;
  return p < eps ? eps : p > 1 - eps ? 1 - eps : p;
}

/**
 * Fit Platt scaling: a 1-D logistic regression of binary `labels` on raw model
 * `scores`, yielding `{ a, b }` for `sigmoid(a*s + b)`. Trained by batch
 * gradient descent on log-loss. `a` is initialised positive (1) so the map is
 * monotone increasing in the score for any normally-ordered model; with a
 * sane (positively-ranking) input it converges to `a >= 0`, preserving order.
 *
 * Returns the identity-ish map `{ a: 1, b: 0 }` when there isn't enough data
 * or only one class is present (nothing to calibrate against).
 */
export function plattScaling(
  scores: number[],
  labels: number[],
  opts?: { epochs?: number; lr?: number },
): PlattParams {
  const n = Math.min(scores.length, labels.length);
  if (n < 2) return { a: 1, b: 0 };
  let pos = 0;
  for (let i = 0; i < n; i++) if (labels[i] >= 0.5) pos += 1;
  if (pos === 0 || pos === n) return { a: 1, b: 0 };

  const epochs = opts?.epochs ?? 600;
  const lr = opts?.lr ?? 0.5;
  let a = 1;
  let b = 0;
  for (let epoch = 0; epoch < epochs; epoch++) {
    let gradA = 0;
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const s = scores[i];
      const p = sigmoid(a * s + b);
      const err = p - labels[i];
      gradA += err * s;
      gradB += err;
    }
    a -= lr * (gradA / n);
    b -= lr * (gradB / n);
  }
  return { a, b };
}

/** Apply a fitted Platt map to one raw score. */
export function applyPlatt(score: number, p: PlattParams): number {
  return sigmoid(p.a * score + p.b);
}

/* -------------------------------------------------------------------------- */
/* Isotonic regression                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A fitted isotonic calibrator: a non-decreasing step function defined by
 * breakpoints `x` (sorted ascending) and their fitted values `y`. Apply with
 * {@link applyIsotonic}.
 */
export interface IsotonicModel {
  /** Ascending raw-score breakpoints. */
  x: number[];
  /** Monotone non-decreasing fitted probabilities, aligned with `x`. */
  y: number[];
}

/**
 * Fit isotonic regression of `labels` on `scores` by the Pool-Adjacent-
 * Violators Algorithm (PAVA). Produces a monotone non-decreasing step function
 * that minimises squared error subject to monotonicity — a flexible,
 * assumption-free calibrator. Ties in score are merged before pooling so the
 * result is a proper function. Falls back to a flat map at the base rate when
 * there's <2 points.
 */
export function isotonicRegression(
  scores: number[],
  labels: number[],
): IsotonicModel {
  const n = Math.min(scores.length, labels.length);
  if (n === 0) return { x: [0, 1], y: [0, 0] };
  if (n === 1) return { x: [scores[0]], y: [clampP(labels[0])] };

  // 1) sort by score and merge exact ties (average their labels).
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => scores[i] - scores[j],
  );
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  for (const idx of order) {
    const s = scores[idx];
    const y = labels[idx];
    if (xs.length > 0 && xs[xs.length - 1] === s) {
      const k = xs.length - 1;
      const w = ws[k] + 1;
      ys[k] = (ys[k] * ws[k] + y) / w;
      ws[k] = w;
    } else {
      xs.push(s);
      ys.push(y);
      ws.push(1);
    }
  }

  // 2) PAVA: pool adjacent blocks that violate monotonicity.
  const blkY = [...ys];
  const blkW = [...ws];
  const blkX = [...xs];
  let i = 0;
  while (i < blkY.length - 1) {
    if (blkY[i] > blkY[i + 1] + 1e-15) {
      // merge i+1 into i (weighted mean). Keep the LEFT breakpoint x[i] so the
      // step function is right-continuous: every score >= a block's left edge
      // (and below the next block's left edge) maps to that block's value.
      const w = blkW[i] + blkW[i + 1];
      blkY[i] = (blkY[i] * blkW[i] + blkY[i + 1] * blkW[i + 1]) / w;
      blkW[i] = w;
      // blkX[i] (left edge) is retained; drop the absorbed block's edge.
      blkY.splice(i + 1, 1);
      blkW.splice(i + 1, 1);
      blkX.splice(i + 1, 1);
      if (i > 0) i -= 1; // back up: the merge may break the prior pair
    } else {
      i += 1;
    }
  }

  return { x: blkX, y: blkY.map(clampP) };
}

/**
 * Apply a fitted isotonic model to one raw score (piecewise-constant /
 * right-continuous step; clamps below the first / above the last breakpoint).
 */
export function applyIsotonic(score: number, model: IsotonicModel): number {
  const { x, y } = model;
  if (x.length === 0) return 0.5;
  if (score <= x[0]) return y[0];
  if (score >= x[x.length - 1]) return y[y.length - 1];
  // binary search for the last breakpoint <= score.
  let lo = 0;
  let hi = x.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (x[mid] <= score) lo = mid;
    else hi = mid - 1;
  }
  return y[lo];
}

/* -------------------------------------------------------------------------- */
/* Calibration quality                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Brier score = mean squared error between predicted probabilities and binary
 * outcomes. Lower is better; 0 is perfect, 0.25 is a constant 0.5 guess. NaN
 * when there are no points.
 */
export function brierScore(probs: number[], labels: number[]): number {
  const n = Math.min(probs.length, labels.length);
  if (n === 0) return NaN;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = probs[i] - labels[i];
    sum += d * d;
  }
  return sum / n;
}

/** One row of a reliability diagram. */
export interface ReliabilityBin {
  /** Bin lower edge (inclusive), e.g. 0.0, 0.1, … */
  lo: number;
  /** Bin upper edge (exclusive, except the last which is inclusive). */
  hi: number;
  /** Count of predictions that fell in the bin. */
  count: number;
  /** Mean predicted probability in the bin. */
  meanPredicted: number;
  /** Observed win fraction in the bin (the calibration target). */
  observed: number;
}

/**
 * Bucket predictions into `bins` equal-width probability bins and report, per
 * bin, the mean predicted probability vs the observed outcome fraction — the
 * data behind a reliability diagram. Empty bins are omitted.
 */
export function reliabilityBins(
  probs: number[],
  labels: number[],
  bins = 10,
): ReliabilityBin[] {
  const b = Math.max(1, Math.floor(bins));
  const sumP = new Array<number>(b).fill(0);
  const sumY = new Array<number>(b).fill(0);
  const cnt = new Array<number>(b).fill(0);
  const n = Math.min(probs.length, labels.length);
  for (let i = 0; i < n; i++) {
    const p = Math.max(0, Math.min(1, probs[i]));
    let k = Math.floor(p * b);
    if (k >= b) k = b - 1; // p === 1 → last bin
    sumP[k] += p;
    sumY[k] += labels[i];
    cnt[k] += 1;
  }
  const out: ReliabilityBin[] = [];
  for (let k = 0; k < b; k++) {
    if (cnt[k] === 0) continue;
    out.push({
      lo: k / b,
      hi: (k + 1) / b,
      count: cnt[k],
      meanPredicted: sumP[k] / cnt[k],
      observed: sumY[k] / cnt[k],
    });
  }
  return out;
}

/**
 * Expected Calibration Error: weighted mean absolute gap between predicted and
 * observed probability across reliability bins. 0 = perfectly calibrated.
 */
export function expectedCalibrationError(
  probs: number[],
  labels: number[],
  bins = 10,
): number {
  const rows = reliabilityBins(probs, labels, bins);
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return NaN;
  let ece = 0;
  for (const r of rows) {
    ece += (r.count / total) * Math.abs(r.meanPredicted - r.observed);
  }
  return ece;
}

/* -------------------------------------------------------------------------- */
/* Per-feature explainability (logistic "SHAP-like")                          */
/* -------------------------------------------------------------------------- */

/** A single feature's signed contribution to one logit. */
export interface FeatureContribution {
  /** Feature index in the model's weight vector. */
  index: number;
  /** Human label for the feature (falls back to `feature N`). */
  name: string;
  /** Standardized feature value used in the model. */
  value: number;
  /** Signed contribution to the logit: `w_i * x_i_standardized`. */
  contribution: number;
}

/** The full additive decomposition of one prediction's logit. */
export interface ContributionBreakdown {
  /** Model intercept (bias). */
  bias: number;
  /** Per-feature contributions, sorted by |contribution| descending. */
  contributions: FeatureContribution[];
  /** Sum of all contributions (excludes bias). */
  total: number;
  /** Top positive drivers (contribution > 0), strongest first. */
  topPositive: FeatureContribution[];
  /** Top negative drivers (contribution < 0), strongest first. */
  topNegative: FeatureContribution[];
}

/**
 * Decompose a logistic prediction into per-feature signed contributions.
 *
 * For logistic regression the logit is exactly additive:
 * `z = bias + Σ w_i * x_i` (in standardized space), so `w_i * x_i` is the
 * faithful, exact contribution of feature `i` (the logistic analogue of a SHAP
 * value — no approximation needed). Inputs are RAW features + the model's
 * scaler; standardization is applied here identically to `predictProba`, so the
 * contributions reconstruct the served probability.
 *
 * @param weights     model weights (standardized space)
 * @param bias        model intercept
 * @param features    RAW (unstandardized) feature vector
 * @param mean        per-feature mean from the scaler
 * @param std         per-feature std from the scaler (>0)
 * @param names       optional human labels, aligned with weights
 * @param topK        how many drivers to surface per side (default 3)
 */
export function featureContributions(
  weights: number[],
  bias: number,
  features: number[],
  mean: number[],
  std: number[],
  names?: string[],
  topK = 3,
): ContributionBreakdown {
  const d = weights.length;
  const contributions: FeatureContribution[] = [];
  let total = 0;
  for (let j = 0; j < d; j++) {
    const raw = features[j] ?? 0;
    const m = mean[j] ?? 0;
    const s = std[j] || 1;
    const xStd = (raw - m) / s;
    const contribution = weights[j] * xStd;
    total += contribution;
    contributions.push({
      index: j,
      name: names?.[j] ?? `feature ${j}`,
      value: xStd,
      contribution,
    });
  }
  contributions.sort((a, c) => Math.abs(c.contribution) - Math.abs(a.contribution));

  const positives = contributions
    .filter((c) => c.contribution > 0)
    .sort((a, c) => c.contribution - a.contribution);
  const negatives = contributions
    .filter((c) => c.contribution < 0)
    .sort((a, c) => a.contribution - c.contribution);

  return {
    bias,
    contributions,
    total,
    topPositive: positives.slice(0, Math.max(0, topK)),
    topNegative: negatives.slice(0, Math.max(0, topK)),
  };
}
