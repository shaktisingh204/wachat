/**
 * SabSMS journeys — A/B variant assignment + auto-winner promotion.
 *
 * Assignment is DETERMINISTIC: sha256(`${runId}:${stepId}`) mod the
 * total weight, walked across the variant weights. The same run always
 * lands on the same arm, replays never flip variants, and the split
 * converges to the declared weights across runs.
 *
 * Winner promotion (`maybePromoteWinner`) fires once every variant has
 * at least `sampleThreshold` sends (default 200): the winner is the arm
 * with the best reply rate, falling back to click rate when nobody
 * replied. Promotion rewrites the step to the single winning template
 * and records the decision under `journey.ab.winners[stepId]`.
 *
 * Pure module + store-injected promotion — worker-safe, test-friendly.
 */

import { createHash } from 'node:crypto';

import type { JourneyAbVariant, JourneyAbWinner, JourneySendStep, SabsmsJourney } from './types';
import type { JourneyStore } from './store';

export const DEFAULT_AB_SAMPLE_THRESHOLD = 200;

// ─── Deterministic assignment ─────────────────────────────────────────────

/**
 * Pick the A/B arm for `(runId, stepId)`. Variants with weight <= 0 are
 * ignored; an empty/zero-weight list returns undefined (caller falls
 * back to the step's control `templateId`).
 */
export function pickVariant(
  runId: string,
  stepId: string,
  variants: JourneyAbVariant[] | undefined,
): JourneyAbVariant | undefined {
  const arms = (variants ?? []).filter((v) => v.weight > 0 && v.templateId);
  if (arms.length === 0) return undefined;
  if (arms.length === 1) return arms[0];

  const total = arms.reduce((sum, v) => sum + v.weight, 0);
  const digest = createHash('sha256').update(`${runId}:${stepId}`).digest();
  // First 6 bytes → 48-bit integer (exact in a JS double).
  const n = digest.readUIntBE(0, 6);
  let point = n % total;
  // Fractional weights: scale the modulo space when weights aren't ints.
  if (!arms.every((v) => Number.isInteger(v.weight))) {
    point = (n / 2 ** 48) * total;
  }

  let cursor = 0;
  for (const arm of arms) {
    cursor += arm.weight;
    if (point < cursor) return arm;
  }
  return arms[arms.length - 1];
}

// ─── Winner math (pure) ───────────────────────────────────────────────────

export interface VariantStats {
  templateId: string;
  sent: number;
  delivered: number;
  replied: number;
  clicked: number;
}

export interface WinnerDecision {
  templateId: string;
  metric: 'reply' | 'click';
  rate: number;
  /** Total sends across all arms at decision time. */
  samples: number;
}

/**
 * Decide a winner from per-variant stats.
 *
 * Returns null when:
 *  - any declared variant has fewer than `minSamplesPerVariant` sends
 *    (insufficient sample), or
 *  - no arm has a single reply OR click (no signal to decide on).
 *
 * Ties go to the first variant in declaration order (stable/deterministic).
 */
export function computeWinner(
  variants: JourneyAbVariant[],
  stats: VariantStats[],
  minSamplesPerVariant: number = DEFAULT_AB_SAMPLE_THRESHOLD,
): WinnerDecision | null {
  if (variants.length < 2) return null;
  const byId = new Map(stats.map((s) => [s.templateId, s]));

  const rows = variants.map((v) => {
    const s = byId.get(v.templateId);
    return {
      templateId: v.templateId,
      sent: s?.sent ?? 0,
      replied: s?.replied ?? 0,
      clicked: s?.clicked ?? 0,
    };
  });

  if (rows.some((r) => r.sent < minSamplesPerVariant)) return null;

  const totalSent = rows.reduce((sum, r) => sum + r.sent, 0);
  const anyReplies = rows.some((r) => r.replied > 0);
  const metric: 'reply' | 'click' = anyReplies ? 'reply' : 'click';
  const rateOf = (r: (typeof rows)[number]) =>
    r.sent === 0 ? 0 : (metric === 'reply' ? r.replied : r.clicked) / r.sent;

  if (!anyReplies && !rows.some((r) => r.clicked > 0)) return null;

  let winner = rows[0];
  for (const row of rows.slice(1)) {
    if (rateOf(row) > rateOf(winner)) winner = row;
  }

  return {
    templateId: winner.templateId,
    metric,
    rate: rateOf(winner),
    samples: totalSent,
  };
}

// ─── Promotion (store-backed) ─────────────────────────────────────────────

export interface PromoteOptions {
  /** Override the sample gate (journey.ab.sampleThreshold otherwise). */
  sampleThresholdOverride?: number;
  /** Skip the sample gate entirely (manual "promote now"). */
  force?: boolean;
  now?: () => Date;
}

export type PromoteResult =
  | { promoted: true; winner: JourneyAbWinner }
  | { promoted: false; reason: 'no_ab' | 'already_promoted' | 'insufficient_sample' | 'no_signal' | 'not_found' };

/**
 * Evaluate one A/B send step and promote the winner when the sample +
 * signal gates pass. Idempotent: an already-promoted step short-circuits.
 */
export async function maybePromoteWinner(
  store: JourneyStore,
  journey: SabsmsJourney,
  stepId: string,
  opts: PromoteOptions = {},
): Promise<PromoteResult> {
  const now = opts.now ?? (() => new Date());
  const step = journey.steps.find((s) => s.id === stepId);
  if (!step || step.kind !== 'send') return { promoted: false, reason: 'not_found' };

  const sendStep = step as JourneySendStep;
  if (!sendStep.abVariants || sendStep.abVariants.length < 2) {
    return { promoted: false, reason: 'no_ab' };
  }
  if (journey.ab?.winners?.[stepId]) {
    return { promoted: false, reason: 'already_promoted' };
  }

  const threshold = opts.force
    ? 0
    : opts.sampleThresholdOverride ??
      journey.ab?.sampleThreshold ??
      DEFAULT_AB_SAMPLE_THRESHOLD;

  const stats = await store.collectVariantStats(
    String(journey._id),
    stepId,
    sendStep.abVariants.map((v) => v.templateId),
  );

  const decision = computeWinner(sendStep.abVariants, stats, Math.max(threshold, 1));
  if (!decision) {
    const sampled = stats.every(
      (s) => s.sent >= (threshold > 0 ? threshold : 1),
    );
    return {
      promoted: false,
      reason: sampled && stats.length > 0 ? 'no_signal' : 'insufficient_sample',
    };
  }

  const winner: JourneyAbWinner = {
    templateId: decision.templateId,
    metric: decision.metric,
    rate: decision.rate,
    samples: decision.samples,
    decidedAt: now(),
    note: `Auto-promoted by ${decision.metric} rate ${(decision.rate * 100).toFixed(2)}% over ${decision.samples} sends`,
  };

  await store.promoteWinner(String(journey._id), stepId, winner);
  return { promoted: true, winner };
}
