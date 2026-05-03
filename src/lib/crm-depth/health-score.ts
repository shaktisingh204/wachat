/**
 * Customer health scoring.
 *
 * Combines configurable signals (usage, NPS, support volume, billing,
 * adoption depth, etc.) into a 0-100 score plus a categorical status and
 * action recommendations.
 */
import type { HealthScore, HealthSignal } from './types';

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function statusFor(score: number): HealthScore['status'] {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'at-risk';
  return 'critical';
}

function normaliseSignal(s: HealthSignal): number {
  const benchmark = s.benchmark ?? 1;
  if (benchmark <= 0) return 0;
  // Map raw value into 0..1 against benchmark, respecting direction.
  if (s.direction === 'higher-better') {
    return clamp(s.value / benchmark, 0, 1);
  }
  // lower-better — invert so 0 raw = 1 normalised, benchmark = 0.
  if (s.value <= 0) return 1;
  return clamp(1 - (s.value / benchmark), 0, 1);
}

function recommend(
  score: number,
  signals: HealthSignal[],
): string[] {
  const out: string[] = [];
  if (score < 40) out.push('Schedule executive business review immediately.');
  for (const s of signals) {
    const norm = normaliseSignal(s);
    if (norm < 0.3) {
      out.push(`Investigate low ${s.key} (raw=${s.value}, target=${s.benchmark ?? 'n/a'}).`);
    }
  }
  if (out.length === 0 && score >= 70) out.push('Pursue expansion or referral.');
  return out;
}

/**
 * Compute a 0-100 health score from a list of weighted signals.
 *
 * Signal weights are normalised internally; pass any positive numbers.
 */
export function scoreHealth(
  customerId: string,
  signals: HealthSignal[],
): HealthScore {
  const totalWeight = signals.reduce((s, x) => s + Math.max(0, x.weight), 0);
  if (totalWeight <= 0) {
    return {
      customerId,
      score: 0,
      status: 'critical',
      signals: [],
      computedAt: new Date().toISOString(),
      recommendations: ['Configure health signals before scoring.'],
    };
  }

  const breakdown = signals.map(s => {
    const w = Math.max(0, s.weight) / totalWeight;
    const norm = normaliseSignal(s);
    return {
      key: s.key,
      weight: w,
      normalised: Math.round(norm * 1000) / 1000,
      contribution: Math.round(norm * w * 100 * 100) / 100,
    };
  });

  const aggregate = breakdown.reduce((acc, b) => acc + b.normalised * b.weight, 0);
  const score = Math.round(clamp(aggregate, 0, 1) * 100);

  return {
    customerId,
    score,
    status: statusFor(score),
    signals: breakdown,
    computedAt: new Date().toISOString(),
    recommendations: recommend(score, signals),
  };
}

/**
 * Convenience helper: score a batch of customers.
 */
export function scoreHealthBatch(
  inputs: { customerId: string; signals: HealthSignal[] }[],
): HealthScore[] {
  return inputs.map(i => scoreHealth(i.customerId, i.signals));
}
