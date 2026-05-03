/**
 * Deal scoring — combines rule-based heuristics with a configurable
 * linear-weight "ML stub". Returns a normalised 0-100 `DealScore` with
 * a transparent breakdown of contributions per signal.
 */
import type {
  Deal,
  DealScore,
  DealScoreBreakdown,
  SignalWeight,
} from './types';

/**
 * Default signal weights used when a caller does not supply their own.
 * Weights are relative — they are normalised internally to sum to 1.
 */
export const DEFAULT_SIGNAL_WEIGHTS: SignalWeight[] = [
  { signal: 'engagement', weight: 0.25, maxValue: 100 },
  { signal: 'budget', weight: 0.20, maxValue: 1 },
  { signal: 'authority', weight: 0.15, maxValue: 1 },
  { signal: 'need', weight: 0.15, maxValue: 1 },
  { signal: 'timing', weight: 0.10, maxValue: 1 },
  { signal: 'fit', weight: 0.15, maxValue: 1 },
];

export type DealSignals = Record<string, number>;

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function normaliseWeights(weights: SignalWeight[]): SignalWeight[] {
  const total = weights.reduce((s, w) => s + Math.max(0, w.weight), 0);
  if (total <= 0) return weights.map(w => ({ ...w, weight: 0 }));
  return weights.map(w => ({ ...w, weight: Math.max(0, w.weight) / total }));
}

function gradeFor(score: number): DealScore['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

/**
 * Apply rule-based adjustments grounded in the deal record itself.
 * Returns a delta in normalised 0..1 space, plus a breakdown line.
 */
function applyRuleAdjustments(
  deal: Deal,
): { delta: number; breakdown: DealScoreBreakdown[] } {
  const breakdown: DealScoreBreakdown[] = [];
  let delta = 0;

  // Stagnant deal — older than 60 days without an update.
  if (deal.updatedAt) {
    const ageDays =
      (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 60) {
      delta -= 0.1;
      breakdown.push({
        signal: 'rule:stale-deal',
        weight: 1,
        rawValue: ageDays,
        contribution: -10,
      });
    }
  }

  // Probability override raises confidence directly.
  if (typeof deal.probability === 'number') {
    const norm = clamp(deal.probability, 0, 100) / 100;
    const contribution = norm * 0.05; // up to +5 boost
    delta += contribution;
    breakdown.push({
      signal: 'rule:probability-override',
      weight: 0.05,
      rawValue: deal.probability,
      contribution: contribution * 100,
    });
  }

  // High-value deal bump (configurable threshold could come from settings).
  if (deal.amount >= 50000) {
    delta += 0.03;
    breakdown.push({
      signal: 'rule:high-value',
      weight: 0.03,
      rawValue: deal.amount,
      contribution: 3,
    });
  }

  // Penalise abandoned deals.
  if (deal.status === 'abandoned') {
    delta -= 0.2;
    breakdown.push({
      signal: 'rule:abandoned',
      weight: 1,
      rawValue: 1,
      contribution: -20,
    });
  }

  return { delta, breakdown };
}

function buildRecommendations(
  score: number,
  signals: DealSignals,
): string[] {
  const recs: string[] = [];
  if (score < 40) {
    recs.push('Re-qualify deal — score is below threshold.');
  }
  if ((signals.engagement ?? 0) < 30) {
    recs.push('Increase engagement: schedule a check-in or send value-add content.');
  }
  if ((signals.authority ?? 0) < 0.5) {
    recs.push('Identify and engage the economic buyer.');
  }
  if ((signals.timing ?? 0) < 0.3) {
    recs.push('Confirm timeline — deal may be stalled.');
  }
  if (recs.length === 0 && score >= 70) {
    recs.push('On track — push for next-stage commitment.');
  }
  return recs;
}

export interface ScoreOptions {
  weights?: SignalWeight[];
  /** When true, suppress rule-based adjustments and use only weighted signals. */
  pureLinear?: boolean;
}

/**
 * Compute a 0-100 `DealScore` for a deal given a map of signal → raw value.
 *
 * Signals are normalised against `maxValue` from `SignalWeight` (default 1)
 * and combined as a weighted linear sum. Optional rule-based adjustments add
 * heuristics (stagnation, high-value, abandoned, etc.).
 */
export function scoreDeal(
  deal: Deal,
  signals: DealSignals,
  options: ScoreOptions = {},
): DealScore {
  const weights = normaliseWeights(options.weights ?? DEFAULT_SIGNAL_WEIGHTS);

  const breakdown: DealScoreBreakdown[] = [];
  let weightedSum = 0;

  for (const w of weights) {
    const raw = signals[w.signal] ?? 0;
    const max = w.maxValue ?? 1;
    const normalised = max > 0 ? clamp(raw / max, 0, 1) : 0;
    const contribution = normalised * w.weight; // 0..weight
    weightedSum += contribution;
    breakdown.push({
      signal: w.signal,
      weight: w.weight,
      rawValue: raw,
      contribution: Math.round(contribution * 100 * 100) / 100,
    });
  }

  let scoreNorm = clamp(weightedSum, 0, 1);

  if (!options.pureLinear) {
    const ruleAdjust = applyRuleAdjustments(deal);
    scoreNorm = clamp(scoreNorm + ruleAdjust.delta, 0, 1);
    breakdown.push(...ruleAdjust.breakdown);
  }

  const score = Math.round(scoreNorm * 100);
  return {
    dealId: deal.id,
    score,
    grade: gradeFor(score),
    breakdown,
    computedAt: new Date().toISOString(),
    recommendedActions: buildRecommendations(score, signals),
  };
}

/**
 * Convenience helper: score a batch of deals.
 */
export function scoreDeals(
  deals: Deal[],
  signalsByDeal: Record<string, DealSignals>,
  options?: ScoreOptions,
): DealScore[] {
  return deals.map(d => scoreDeal(d, signalsByDeal[d.id] ?? {}, options));
}
