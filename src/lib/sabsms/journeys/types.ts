/**
 * SabSMS journeys (V2.9) — shared types + zod schemas + pure step helpers.
 *
 * A journey is a "linear with branches" automation: an ordered `steps`
 * array executed top-to-bottom, where `branch` / `waitUntil` steps may
 * jump to any step id. Runs (`sabsms_journey_runs`) are the per-contact
 * state machine instances advanced by `executor.ts` inside the
 * `sabsms-events` PM2 worker.
 *
 * IMPORTANT: this module is imported by the standalone PM2 worker (via
 * `events/consumer.ts`) — it must stay free of `server-only` and any
 * Next.js-coupled imports. Pure: zod + mongodb types only.
 */

import { z } from 'zod';
import type { ObjectId } from 'mongodb';

// ─── Collections ──────────────────────────────────────────────────────────

export const SABSMS_JOURNEYS_COLLECTION = 'sabsms_journeys';
export const SABSMS_JOURNEY_RUNS_COLLECTION = 'sabsms_journey_runs';

// ─── Steps ────────────────────────────────────────────────────────────────

export const JourneyEventSchema = z.enum(['replied', 'clicked']);
export type JourneyEvent = z.infer<typeof JourneyEventSchema>;

export const JourneyAbVariantSchema = z.object({
  templateId: z.string().min(1),
  /** Relative weight (> 0). Weights need not sum to anything particular. */
  weight: z.number().positive(),
});
export type JourneyAbVariant = z.infer<typeof JourneyAbVariantSchema>;

export const JourneyConditionOpSchema = z.enum(['eq', 'ne', 'contains', 'gt', 'lt']);
export type JourneyConditionOp = z.infer<typeof JourneyConditionOpSchema>;

export const JourneyConditionSchema = z.object({
  /** Key into the run's `vars` map. */
  field: z.string().min(1),
  op: JourneyConditionOpSchema,
  value: z.string(),
});
export type JourneyCondition = z.infer<typeof JourneyConditionSchema>;

export const JourneySendStepSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('send'),
  templateId: z.string().min(1),
  /** Optional A/B arms. When present, the deterministic picker in
   *  `ab.ts` chooses one per run; `templateId` is the control/fallback. */
  abVariants: z.array(JourneyAbVariantSchema).optional(),
});

export const JourneyWaitStepSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('wait'),
  durationMs: z.number().int().positive(),
});

export const JourneyWaitUntilStepSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('waitUntil'),
  event: JourneyEventSchema,
  timeoutMs: z.number().int().positive(),
  /** Step to jump to when the timeout fires (default: next in array). */
  onTimeoutStepId: z.string().optional(),
  /** Step to jump to when the event arrives (default: next in array). */
  onEventStepId: z.string().optional(),
});

export const JourneyBranchStepSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('branch'),
  condition: JourneyConditionSchema,
  trueStepId: z.string().min(1),
  falseStepId: z.string().min(1),
});

export const JourneyExitStepSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('exit'),
});

export const JourneyStepSchema = z.discriminatedUnion('kind', [
  JourneySendStepSchema,
  JourneyWaitStepSchema,
  JourneyWaitUntilStepSchema,
  JourneyBranchStepSchema,
  JourneyExitStepSchema,
]);
export type JourneyStep = z.infer<typeof JourneyStepSchema>;
export type JourneySendStep = z.infer<typeof JourneySendStepSchema>;
export type JourneyStepKind = JourneyStep['kind'];

// ─── Journey ──────────────────────────────────────────────────────────────

export const JourneyStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);
export type JourneyStatus = z.infer<typeof JourneyStatusSchema>;

export const JourneyTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }),
  z.object({ kind: z.literal('contact_added') }),
  z.object({ kind: z.literal('inbound_keyword'), keyword: z.string().min(1) }),
  z.object({
    kind: z.literal('campaign_completed'),
    /** Restrict to one campaign; absent = any completed campaign. */
    campaignId: z.string().optional(),
  }),
]);
export type JourneyTrigger = z.infer<typeof JourneyTriggerSchema>;

export const JourneyExitRulesSchema = z.object({
  /** Always-on: an unsubscribe exits every active run for that phone. */
  onUnsubscribe: z.literal(true).default(true),
  /** Optional: any inbound reply exits the contact's run. */
  onReply: z.boolean().optional(),
});
export type JourneyExitRules = z.infer<typeof JourneyExitRulesSchema>;

export const JourneyGoalSchema = z.object({
  event: JourneyEventSchema,
  /** Conversion attribution window, from run start. */
  windowMs: z.number().int().positive(),
});
export type JourneyGoal = z.infer<typeof JourneyGoalSchema>;

export const JourneyStatsSchema = z.object({
  started: z.number().int().nonnegative().default(0),
  completed: z.number().int().nonnegative().default(0),
  exited: z.number().int().nonnegative().default(0),
  failed: z.number().int().nonnegative().default(0),
  sends: z.number().int().nonnegative().default(0),
  replies: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  goals: z.number().int().nonnegative().default(0),
});
export type JourneyStats = z.infer<typeof JourneyStatsSchema>;

export function emptyJourneyStats(): JourneyStats {
  return {
    started: 0,
    completed: 0,
    exited: 0,
    failed: 0,
    sends: 0,
    replies: 0,
    clicks: 0,
    goals: 0,
  };
}

/** Recorded when `maybePromoteWinner` (ab.ts) settles an A/B step. */
export const JourneyAbWinnerSchema = z.object({
  templateId: z.string(),
  metric: z.enum(['reply', 'click']),
  rate: z.number(),
  samples: z.number().int().nonnegative(),
  decidedAt: z.date(),
  note: z.string(),
});
export type JourneyAbWinner = z.infer<typeof JourneyAbWinnerSchema>;

export const JourneyAbConfigSchema = z.object({
  /** Min sends per variant before auto-promotion may fire (default 200). */
  sampleThreshold: z.number().int().positive().optional(),
  /** stepId → promotion record. */
  winners: z.record(z.string(), JourneyAbWinnerSchema).optional(),
  /** Throttle marker for the per-tick promotion sweep. */
  lastCheckAt: z.date().optional(),
});
export type JourneyAbConfig = z.infer<typeof JourneyAbConfigSchema>;

export const SabsmsJourneySchema = z.object({
  _id: z.custom<ObjectId>((v) => v != null && typeof v === 'object').optional(),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  status: JourneyStatusSchema,
  trigger: JourneyTriggerSchema,
  steps: z.array(JourneyStepSchema),
  exitRules: JourneyExitRulesSchema,
  goal: JourneyGoalSchema.optional(),
  ab: JourneyAbConfigSchema.optional(),
  stats: JourneyStatsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type SabsmsJourney = z.infer<typeof SabsmsJourneySchema>;

// ─── Runs ─────────────────────────────────────────────────────────────────

export const JourneyRunStatusSchema = z.enum([
  'active',
  'waiting',
  'processing',
  'completed',
  'exited',
  'failed',
]);
export type JourneyRunStatus = z.infer<typeof JourneyRunStatusSchema>;

/** Statuses that count as "in the journey" for dedupe + exits. */
export const LIVE_RUN_STATUSES: JourneyRunStatus[] = ['active', 'waiting', 'processing'];

export const JourneyRunHistoryEntrySchema = z.object({
  stepId: z.string(),
  at: z.date(),
  /** 'enrolled' | 'sent' | 'wait' | 'waiting:replied' | 'branch:true' |
   *  'event:replied' | 'timeout' | 'exit' | 'completed' | error notes… */
  result: z.string(),
  /** A/B arm actually sent (send steps with abVariants). */
  variantTemplateId: z.string().optional(),
  /** Engine message id for send steps. */
  messageId: z.string().optional(),
});
export type JourneyRunHistoryEntry = z.infer<typeof JourneyRunHistoryEntrySchema>;

export const JourneyRunWaitingForSchema = z.object({
  event: JourneyEventSchema,
  timeoutAt: z.date(),
  onEventStepId: z.string().optional(),
  onTimeoutStepId: z.string().optional(),
});
export type JourneyRunWaitingFor = z.infer<typeof JourneyRunWaitingForSchema>;

export const SabsmsJourneyRunSchema = z.object({
  _id: z.custom<ObjectId>((v) => v != null && typeof v === 'object').optional(),
  journeyId: z.string().min(1),
  workspaceId: z.string().min(1),
  contactPhone: z.string().min(1),
  /** sha256(lowercased trimmed e164) — matches `sabsms_suppressions.phoneHash`
   *  and the engine's `contactUnsubscribed.phoneHash`. */
  contactPhoneHash: z.string().min(1),
  contactId: z.string().optional(),
  currentStepId: z.string(),
  status: JourneyRunStatusSchema,
  /** When a waiting run becomes due (wait timer or waitUntil timeout). */
  wakeAt: z.date().optional(),
  /** Claim stamp — `processing` rows older than the stale window are
   *  reclaimed so runs survive worker crashes/restarts. */
  processingAt: z.date().optional(),
  /** Transient send-step retries already attempted (enqueue exceptions
   *  re-park the run with backoff up to a cap; reset on success). */
  retryCount: z.number().int().nonnegative().optional(),
  waitingFor: JourneyRunWaitingForSchema.optional(),
  vars: z.record(z.string(), z.string()),
  history: z.array(JourneyRunHistoryEntrySchema),
  idempotency: z.object({ lastExecutedStepKey: z.string().optional() }),
  repliedAt: z.date().optional(),
  clickedAt: z.date().optional(),
  goalMetAt: z.date().optional(),
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
});
export type SabsmsJourneyRun = z.infer<typeof SabsmsJourneyRunSchema>;

// ─── Pure step helpers ────────────────────────────────────────────────────

export function findStep(steps: JourneyStep[], stepId: string): JourneyStep | undefined {
  return steps.find((s) => s.id === stepId);
}

/** Default advance: the next step in array order, or undefined at the end. */
export function nextStepIdAfter(steps: JourneyStep[], stepId: string): string | undefined {
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return undefined;
  return steps[idx + 1]?.id;
}

/** Idempotency key for one step execution within one run. */
export function stepExecutionKey(runId: string, stepId: string): string {
  return `${runId}:${stepId}`;
}

/** Message tags stamped on journey sends (drives A/B stats aggregation). */
export function journeyMessageTags(
  journeyId: string,
  stepId: string,
  variantTemplateId?: string,
): string[] {
  const tags = ['journey', `journey:${journeyId}`, `journeyStep:${stepId}`];
  if (variantTemplateId) tags.push(`journeyVariant:${variantTemplateId}`);
  return tags;
}
