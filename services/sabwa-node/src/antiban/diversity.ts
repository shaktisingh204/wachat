/**
 * Content-diversity guard.
 *
 * SABWA_PLAN.md §9.4: refuse to send if a session has already pushed
 * ≥50 *identical* message bodies within the trailing 60 minutes. This
 * is a strong predictor of spam-flagging on WhatsApp's side — even with
 * tame per-minute rates, hammering the same text at 100 contacts back
 * to back lights up the heuristics.
 *
 * Implementation: per-session per-body counter stored as a Redis sorted
 * set keyed by body hash. On each gate, we score a fresh entry with the
 * current epoch-ms timestamp, evict members older than the rolling
 * window, and count what's left. If the count exceeds the cap, the gate
 * refuses (without consuming any rate-limit budget).
 *
 * ## Redis key layout
 *
 *   sabwa:diversity:{sessionId}:{bodyHash}   ZSET, score = epochMs
 *     – TTL refreshed to WINDOW_SECONDS on each write so the key cleans
 *       itself up when the body stops being used.
 *
 * The hash is FNV-1a 64-bit (16 hex chars) — fast, dependency-free,
 * stable across processes, and collisions don't matter for a heuristic
 * counter (worst case we slightly *over*-count similar bodies, which
 * fails closed).
 */

import type { RedisHandles } from '../db/redis.js';

/** Refuse a send when this many identical bodies have shipped in the window. */
export const DIVERSITY_CAP_PER_HOUR = 50;
/** Rolling window length, in seconds. */
export const DIVERSITY_WINDOW_SECONDS = 60 * 60;

/** Outcome of a single `check` call. Mirrors the rate-limiter shape. */
export type DiversityDecision =
  | { ok: true }
  | { ok: false; reason: 'duplicate_body'; count: number };

/**
 * 64-bit FNV-1a hash returned as a 16-char hex string. Used as a stable
 * "fingerprint" for message bodies so we can group identical sends in
 * Redis without storing the body itself.
 */
export function hashBody(body: string): string {
  // 64-bit FNV-1a — done with two 32-bit halves to stay within Number
  // precision. Same algorithm Mongo's `db.json` shells use internally.
  let hi = 0xcbf2_9ce4 | 0; // high half of offset basis
  let lo = 0x8422_3325 | 0; // low half of offset basis
  // Multiplicative prime: 0x100_0000_01b3 (1099511628211)
  // We multiply by (hi=0x100, lo=0x000001b3).
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    lo = (lo ^ c) >>> 0;
    // 64-bit multiply, modulo 2^64. The high half accumulates carries.
    const loMul = Math.imul(lo, 0x000001b3) >>> 0;
    const hiMul = (Math.imul(hi, 0x000001b3) + Math.imul(lo, 0x100)) >>> 0;
    // Carry from the bottom 32 bits.
    const carry = Math.floor((lo * 0x000001b3) / 0x1_0000_0000);
    lo = loMul;
    hi = (hiMul + carry) >>> 0;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}

const DIVERSITY_KEY = (sessionId: string, bodyHash: string): string =>
  `sabwa:diversity:${sessionId}:${bodyHash}`;

/**
 * Check whether `body` would breach the per-hour identical-body cap for
 * `sessionId`. On `ok: true`, the call has *already* recorded this send
 * in the rolling window (so concurrent callers see the bump). On
 * `ok: false`, nothing is recorded.
 *
 * The body string itself is never stored — only its FNV-1a hash.
 */
export async function check(
  redis: RedisHandles,
  sessionId: string,
  body: string,
): Promise<DiversityDecision> {
  // Empty bodies (e.g. media-only sends with no caption) bypass the
  // diversity guard — there's nothing meaningful to compare and we'd
  // otherwise cap legitimate media broadcasts.
  if (body.length === 0) return { ok: true };

  const hash = hashBody(body);
  const key = DIVERSITY_KEY(sessionId, hash);
  const client = redis.client;
  const nowMs = Date.now();
  const cutoffMs = nowMs - DIVERSITY_WINDOW_SECONDS * 1_000;

  // Evict anything older than the window. We do this before counting so
  // a long-dormant key correctly resets.
  await client.zRemRangeByScore(key, 0, cutoffMs - 1);

  // Count what's currently in-window. node-redis types differ across
  // versions for ZCARD; the value is always a number.
  const existing = await client.zCard(key);
  if (existing >= DIVERSITY_CAP_PER_HOUR) {
    return { ok: false, reason: 'duplicate_body', count: existing };
  }

  // Speculatively add the new send. We use the epoch-ms as both the
  // score AND a uniqueness suffix on the member, so back-to-back sends
  // in the same millisecond still both count.
  // (ZADD with a duplicate member overwrites the score; appending a
  // monotonically-increasing counter is the standard fix.)
  const member = `${nowMs}-${existing}`;
  await client.zAdd(key, { score: nowMs, value: member });
  await client.expire(key, DIVERSITY_WINDOW_SECONDS);

  return { ok: true };
}
