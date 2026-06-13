/**
 * SabCRM — signed + retried webhook delivery — PURE helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and I/O-free
 * module so the unit tests (`tsx --test`) AND any Client Component can import
 * the deterministic signing / retry math directly. The Mongo + `fetch` side
 * effects live in `./webhook-delivery.server.ts`, which re-exports everything
 * here.
 *
 * ## What this layer adds over the existing webhook subscription store
 *
 * `./webhooks.server.ts` already owns the `sabcrm_webhooks` subscription store
 * and a fire-and-forget `dispatchWebhook`. This module is the *delivery
 * primitive*: it computes the per-request HMAC-SHA-256 signature header value
 * (with a timestamp, so receivers can reject replays), and the deterministic
 * exponential-backoff schedule used by the retry cron. None of it touches the
 * network or the database — those belong in `.server.ts`.
 *
 * ## Signature scheme
 *
 * The signed string is `t=<unixSeconds>.<rawJsonBody>` (Stripe's
 * `Stripe-Signature` convention). The receiver recomputes the HMAC over the
 * SAME `t=….<body>` string using the per-subscription secret and compares in
 * constant time, and SHOULD reject timestamps outside a tolerance window. The
 * header value we emit is `t=<ts>,v1=<hexHmac>` so both the timestamp and the
 * digest travel in a single header (`X-SabNode-Signature`). This is distinct
 * from the body-only `sha256=<hex>` scheme of `@/lib/api-platform/webhooks`,
 * and intentionally so — adding the timestamp into the MAC is what makes the
 * delivery replay-resistant.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/* -------------------------------------------------------------------------- */
/* Tunables (exported so the server + UI share one source of truth)            */
/* -------------------------------------------------------------------------- */

/** Header SabCRM sends the timestamped signature in. */
export const SABCRM_SIGNATURE_HEADER = 'X-SabNode-Signature';
/** Header carrying the same unix-seconds timestamp on its own (convenience). */
export const SABCRM_TIMESTAMP_HEADER = 'X-SabNode-Timestamp';
/** Header carrying the event name. */
export const SABCRM_EVENT_HEADER = 'X-SabNode-Event';
/** Header carrying the unique delivery id (idempotency key for the receiver). */
export const SABCRM_DELIVERY_HEADER = 'X-SabNode-Delivery';

/** Signature scheme version tag emitted in the header (`v1=<hex>`). */
export const SIGNATURE_VERSION = 'v1' as const;

/** Total delivery attempts before a delivery is marked permanently failed. */
export const DEFAULT_MAX_ATTEMPTS = 6;

/** First-retry backoff base (ms). Doubles each attempt up to the cap. */
export const BASE_BACKOFF_MS = 30_000; // 30s

/** Backoff cap (ms) — a single retry never waits longer than this. */
export const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000; // 6h

/* -------------------------------------------------------------------------- */
/* Signing                                                                     */
/* -------------------------------------------------------------------------- */

/** Serialise a body to its canonical request string (verbatim if a string). */
export function canonicalBody(body: unknown): string {
  return typeof body === 'string' ? body : JSON.stringify(body ?? null);
}

/**
 * Compute the timestamped signature header value for a request.
 *
 * @param body       The request body (object → canonical JSON, string → verbatim).
 * @param secret     The per-subscription signing secret.
 * @param timestamp  Unix **seconds** for this delivery. Caller supplies it so the
 *                   SAME timestamp can be sent in {@link SABCRM_TIMESTAMP_HEADER}
 *                   and folded into the MAC (replay protection).
 * @returns `t=<ts>,v1=<hexHmac>` — the value for {@link SABCRM_SIGNATURE_HEADER}.
 * @throws when `secret` is empty (signing an unsecured delivery is a bug).
 */
export function signPayload(
  body: unknown,
  secret: string,
  timestamp: number,
): string {
  if (!secret) throw new Error('signPayload: secret is required');
  const ts = Math.trunc(timestamp);
  const signed = `t=${ts}.${canonicalBody(body)}`;
  const hex = createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  return `t=${ts},${SIGNATURE_VERSION}=${hex}`;
}

/**
 * Parse a `t=<ts>,v1=<hex>` header value into its parts. Returns `null` when
 * the header is malformed or missing either component.
 */
export function parseSignatureHeader(
  header: string,
): { timestamp: number; signature: string } | null {
  if (typeof header !== 'string' || header.length === 0) return null;
  let timestamp: number | null = null;
  let signature: string | null = null;
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === 't') {
      const n = Number(val);
      if (Number.isFinite(n)) timestamp = n;
    } else if (key === SIGNATURE_VERSION) {
      signature = val;
    }
  }
  if (timestamp === null || !signature) return null;
  return { timestamp, signature };
}

/**
 * Constant-time verification of a `t=<ts>,v1=<hex>` header against a body +
 * secret, with an optional replay-tolerance window.
 *
 * @param body       The received raw body.
 * @param secret     The shared signing secret.
 * @param header     The `X-SabNode-Signature` header value.
 * @param opts.toleranceSeconds  Max age (vs `nowSeconds`) the timestamp may have.
 *                               Omit / 0 to skip the freshness check.
 * @param opts.nowSeconds        Override "now" (unix seconds) — for tests.
 */
export function verifySignature(
  body: unknown,
  secret: string,
  header: string,
  opts: { toleranceSeconds?: number; nowSeconds?: number } = {},
): boolean {
  if (!secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const tolerance = opts.toleranceSeconds ?? 0;
  if (tolerance > 0) {
    const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - parsed.timestamp) > tolerance) return false;
  }

  const expectedHex = createHmac('sha256', secret)
    .update(`t=${parsed.timestamp}.${canonicalBody(body)}`, 'utf8')
    .digest('hex');

  // Constant-time compare. timingSafeEqual throws on length mismatch, so guard.
  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(parsed.signature, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* -------------------------------------------------------------------------- */
/* Retry policy                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic exponential backoff for a given (already-completed) attempt.
 *
 * `attempt` is **1-based**: the wait *after* attempt 1 before attempt 2 is
 * `BASE_BACKOFF_MS`, then doubles each attempt, capped at {@link MAX_BACKOFF_MS}.
 *
 * Deterministic (no jitter) so the value can be asserted in tests and stored as
 * an absolute `nextRetryAt` the cron can poll. Non-positive / non-finite
 * attempts clamp to the base delay.
 *
 * @returns delay in milliseconds.
 */
export function backoffDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) ? Math.trunc(attempt) : 1;
  const exponent = Math.max(0, n - 1);
  // Guard against Math.pow overflow blowing past the cap into Infinity.
  if (exponent > 40) return MAX_BACKOFF_MS;
  const delay = BASE_BACKOFF_MS * Math.pow(2, exponent);
  return Math.min(delay, MAX_BACKOFF_MS);
}

/**
 * Whether a delivery that ended on `status` after `attempt` attempts should be
 * retried. A retry happens only when:
 *
 *   - there is an attempt budget left (`attempt < maxAttempts`), AND
 *   - the outcome is retryable: a transport error (`status === null`) or a
 *     retryable HTTP status (408 Request Timeout, 425 Too Early, 429 Too Many
 *     Requests, or any 5xx). Every other 4xx (and 2xx/3xx) is terminal.
 *
 * @param status      HTTP status of the last attempt, or `null` on transport error.
 * @param attempt     The attempt number that just completed (1-based).
 * @param maxAttempts Total attempts permitted (defaults to {@link DEFAULT_MAX_ATTEMPTS}).
 */
export function shouldRetry(
  status: number | null,
  attempt: number,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): boolean {
  if (!(attempt < maxAttempts)) return false;
  if (status === null) return true; // transport error / timeout
  if (status >= 200 && status < 300) return false; // success — never retry
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false; // other 4xx (and 3xx) are terminal
}

/** Convenience: is this HTTP status a success (2xx)? */
export function isSuccessStatus(status: number | null): boolean {
  return status !== null && status >= 200 && status < 300;
}
