/**
 * SabWa — shared constants.
 *
 * Source of truth: `SABWA_PLAN.md` § 3 (collections) and § 9 (anti-ban
 * rate-limit profiles).
 */

/**
 * Mongo collection names for the SabWa module. All collections are
 * prefixed `sabwa_` and scoped by `projectId`.
 */
export const SABWA_COLLECTIONS = {
  sessions: 'sabwa_sessions',
  chats: 'sabwa_chats',
  messages: 'sabwa_messages',
  groups: 'sabwa_groups',
  contacts: 'sabwa_contacts',
  scheduled: 'sabwa_scheduled',
  templates: 'sabwa_templates',
  quickReplies: 'sabwa_quick_replies',
  autoReplies: 'sabwa_auto_replies',
  broadcasts: 'sabwa_broadcasts',
  labels: 'sabwa_labels',
  webhooks: 'sabwa_webhooks',
  auditLog: 'sabwa_audit_log',
  apiKeys: 'sabwa_api_keys',
} as const;

export type SabwaCollectionKey = keyof typeof SABWA_COLLECTIONS;
export type SabwaCollectionName = (typeof SABWA_COLLECTIONS)[SabwaCollectionKey];

/**
 * Anti-ban rate-limit profiles (per session).
 * Mirrors § 9 of the plan.
 *
 * - `perMin`   — max outbound messages per rolling 60s window
 * - `jitterSec`— +/- seconds of humanization delay between sends
 * - `perDay`   — hard cap of outbound messages per UTC day
 */
export interface SabwaRateProfileDef {
  perMin: number;
  jitterSec: number;
  perDay: number;
}

export const SABWA_RATE_PROFILES: Record<
  'safe' | 'normal' | 'aggressive',
  SabwaRateProfileDef
> = {
  safe: { perMin: 8, jitterSec: 4, perDay: 500 },
  normal: { perMin: 15, jitterSec: 3, perDay: 2000 },
  aggressive: { perMin: 30, jitterSec: 2, perDay: 10000 },
} as const;

/**
 * Warmup ramp: new sessions start at 5 msgs/min and ramp linearly to 30
 * msgs/min over 7 days (§ 9).
 */
export const SABWA_WARMUP = {
  startPerMin: 5,
  endPerMin: 30,
  rampDays: 7,
} as const;

/**
 * Redis channels / queues used by the SabWa worker.
 */
export const SABWA_REDIS = {
  eventsChannel: (sessionId: string) => `sabwa:${sessionId}:events`,
  outboundQueue: (sessionId: string) => `sabwa:${sessionId}:outbound`,
  scheduledQueue: 'sabwa:scheduled',
  bulkQueue: (campaignId: string) => `sabwa:bulk:${campaignId}`,
} as const;
