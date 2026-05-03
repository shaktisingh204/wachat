/**
 * Performance — OKR tracking, 360 reviews, and calibration.
 */

import type { Goal, Okr, Review, ID } from './types';

export function rollUpOkrProgress(okr: Okr): number {
  if (okr.keyResults.length === 0) return 0;
  const sum = okr.keyResults.reduce((s, kr) => s + clamp(kr.progress, 0, 100), 0);
  return Math.round(sum / okr.keyResults.length);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function progressFromMetric(current?: number, target?: number): number {
  if (target == null || target === 0 || current == null) return 0;
  return clamp(Math.round((current / target) * 100), 0, 100);
}

export function classifyGoal(progress: number, daysToDeadline?: number): Goal['status'] {
  if (progress >= 100) return 'achieved';
  if (daysToDeadline != null && daysToDeadline < 0 && progress < 100) return 'missed';
  if (progress >= 80) return 'on-track';
  if (progress >= 50) return 'at-risk';
  return 'off-track';
}

export interface ReviewAggregate {
  employeeId: ID;
  cycle: string;
  averageByCompetency: Record<string, number>;
  overall: number;
  reviewerCount: number;
  byType: Partial<Record<Review['type'], number>>;
}

export function aggregate360(reviews: Review[]): ReviewAggregate | null {
  if (reviews.length === 0) return null;
  const employeeId = reviews[0].employeeId;
  const cycle = reviews[0].cycle;
  const compTotals: Record<string, { sum: number; n: number }> = {};
  const byType: Partial<Record<Review['type'], number>> = {};
  for (const r of reviews) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    for (const rt of r.ratings) {
      compTotals[rt.competency] ??= { sum: 0, n: 0 };
      compTotals[rt.competency].sum += rt.score;
      compTotals[rt.competency].n += 1;
    }
  }
  const averageByCompetency: Record<string, number> = {};
  let overallSum = 0;
  let overallN = 0;
  for (const [k, v] of Object.entries(compTotals)) {
    averageByCompetency[k] = round2(v.sum / v.n);
    overallSum += v.sum;
    overallN += v.n;
  }
  return {
    employeeId,
    cycle,
    averageByCompetency,
    overall: overallN === 0 ? 0 : round2(overallSum / overallN),
    reviewerCount: reviews.length,
    byType,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calibrate ratings to a forced distribution: top 20%, high 30%, meets 40%,
 * below 10%. Returns a band per employee.
 */
export function calibrate(
  scores: Array<{ employeeId: ID; overall: number }>,
): Array<{ employeeId: ID; overall: number; band: NonNullable<Review['calibrationBand']> }> {
  const sorted = [...scores].sort((a, b) => b.overall - a.overall);
  const n = sorted.length;
  const topCutoff = Math.ceil(n * 0.2);
  const highCutoff = topCutoff + Math.ceil(n * 0.3);
  const meetsCutoff = highCutoff + Math.ceil(n * 0.4);
  return sorted.map((s, i) => ({
    ...s,
    band: i < topCutoff ? 'top' : i < highCutoff ? 'high' : i < meetsCutoff ? 'meets' : 'below',
  }));
}
