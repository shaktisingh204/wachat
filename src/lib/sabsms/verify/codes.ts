/**
 * SabSMS v3.1 — Verify code primitives.
 *
 * The Next-side Verify orchestrator owns the code lifecycle (generate →
 * salted-hash at rest → constant-time check), mirroring the engine's OTP
 * store hashing (`codeHash = sha256(code + salt)`, see
 * services/sabsms-engine/src/otp/store.rs) so the two stay conceptually
 * aligned. Pure helpers — no IO.
 */

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Uniform random numeric code of `length` digits (rejection-free via
 *  `randomInt`, which is unbiased over [0, 10)). */
export function generateNumericCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += randomInt(0, 10).toString();
  return out;
}

/** 16-byte random salt as lowercase hex. */
export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

/** `sha256(code + salt)` hex — what's stored at rest. */
export function hashCode(code: string, salt: string): string {
  return createHash('sha256').update(code + salt).digest('hex');
}

/** Constant-time hex-digest comparison (both sides are sha256 hex, so a
 *  length mismatch is itself a non-match and safe to short-circuit). */
export function hashEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** sha256 of a recipient (E.164 or lowercased email) — no PII at rest. */
export function recipientHash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
