/**
 * Anti-ban gate — single entry point sibling agents call **before**
 * dispatching any outbound message.
 *
 * Wiring contract:
 *   - `BaileysSession.send(...)` MUST `await gate(...)`, then sleep
 *     `decision.sleepMs`, then dispatch.
 *   - The bulk-sender worker MUST `await gate(...)` per message; on
 *     `ok: false`, it pauses the campaign with `decision.reason`.
 *   - The `/v1/messages` send route MUST `await gate(...)` and 429 on
 *     `ok: false`.
 *
 * The gate combines three checks **in priority order**:
 *   1. Presence — if Baileys reported `stream:error` / disconnect, refuse.
 *   2. Diversity — refuse if ≥50 identical bodies in the last hour.
 *   3. Rate limit — token-bucket decrement against profile + warmup.
 *
 * Order matters: presence is cheapest (single HGET) and a hard stop,
 * diversity is next and consumes no budget, rate-limit is last and
 * mutates Redis. We never want to "spend" a token on a send that's
 * already doomed by presence or diversity.
 */

import type { RedisHandles } from '../db/redis.js';
import { check as checkDiversity } from './diversity.js';
import { isPaused } from './presence.js';
import {
  checkAndDecrement,
  type RateLimitDecision,
} from './rate-limit.js';
import { recordVelocityBreach } from './risk-score.js';
import { effectivePerMinute, type WarmupState } from './warmup.js';
import { profileConfig, type RateProfile } from './profiles.js';

/** Persistent session metadata the gate needs. Built from `sabwa_sessions`. */
export interface GateSessionMeta {
  sessionId: string;
  profile: RateProfile;
  warmup: WarmupState;
}

/** Optional body for content-diversity (omit for media-only sends). */
export interface GateMessage {
  /** Message body / caption used for diversity hashing. Omit for media. */
  body?: string;
}

/** Reasons a gate can refuse a send. */
export type GateRefuseReason =
  | 'paused'
  | 'duplicate_body'
  | 'minute_cap'
  | 'day_cap';

/** Gate decision. On `ok: true`, the caller MUST sleep `sleepMs` then send. */
export type GateDecision =
  | { ok: true; sleepMs: number }
  | { ok: false; reason: GateRefuseReason };

/**
 * Single anti-ban gate every outbound send must traverse.
 *
 * Side effects on `ok: true`: increments per-minute + per-day buckets,
 * appends to the diversity sorted-set. None of these mutations roll back
 * if the actual `sock.sendMessage(...)` later fails — that's intentional
 * for safety (treat attempts as "consumed budget"). Use
 * `risk-score.recordSendFailure(...)` to record the failure side-channel.
 */
export async function gate(
  redis: RedisHandles,
  meta: GateSessionMeta,
  msg: GateMessage = {},
): Promise<GateDecision> {
  // 1) Presence guard — cheapest, returns fast on disconnected sessions.
  if (await isPaused(redis, meta.sessionId)) {
    return { ok: false, reason: 'paused' };
  }

  // 2) Content diversity — runs before consuming rate-limit budget so a
  //    user spamming the same body doesn't burn through their per-minute
  //    cap *and* trip diversity.
  if (typeof msg.body === 'string' && msg.body.length > 0) {
    const d = await checkDiversity(redis, meta.sessionId, msg.body);
    if (!d.ok) return { ok: false, reason: d.reason };
  }

  // 3) Rate limit — token-bucket decrement against profile, with the
  //    warmup ramp applied as an effective `perMinute` cap override.
  const cfg = profileConfig(meta.profile);
  const perMinute = effectivePerMinute(meta.warmup, cfg.perMinute);
  const r: RateLimitDecision = await checkAndDecrement(
    redis,
    meta.sessionId,
    meta.profile,
    { perMinute, perDay: cfg.perDay },
  );

  if (!r.ok) {
    // Side-channel: bumping the velocity-breach counter feeds the risk
    // gauge so the UI reflects "user is repeatedly hitting their cap".
    if (r.reason === 'minute_cap') {
      // Fire-and-forget — never let a metrics write block the send path.
      void recordVelocityBreach(redis, meta.sessionId).catch(() => {
        /* swallowed: risk telemetry is best-effort */
      });
    }
    return { ok: false, reason: r.reason };
  }

  return { ok: true, sleepMs: r.sleepMs };
}

// Re-exports so callers can `import { gate, sleep, ... } from '@/antiban'`.
export { sleep } from './rate-limit.js';
export type { RateProfile, ProfileConfig } from './profiles.js';
export { PROFILES, DEFAULT_PROFILE, profileConfig, isRateProfile } from './profiles.js';
export type { WarmupState } from './warmup.js';
export { effectivePerMinute, isWarming } from './warmup.js';
export type { PresenceStatus, PresencePauseReason } from './presence.js';
export {
  pause,
  resume,
  isPaused,
  getStatus as getPresenceStatus,
  reportStreamError,
  reportDisconnect,
} from './presence.js';
export type { RiskInputs, RiskScore, RiskLevel } from './risk-score.js';
export {
  compute as computeRisk,
  compose as composeRisk,
  recordSendFailure,
  recordBlockedBy,
  recordVelocityBreach,
} from './risk-score.js';
