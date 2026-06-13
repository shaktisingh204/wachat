/**
 * SabSMS outbound webhooks — pure core (V2.13).
 *
 * Worker-safe AND test-safe: Node stdlib only, no Mongo, no
 * `server-only`. The dispatcher (`./dispatch.ts`) and the dashboard
 * actions both build on these primitives.
 *
 * Wire contract (documented on /sabsms/api-docs):
 *
 *   POST <endpoint url>
 *   Content-Type: application/json
 *   X-Sabsms-Signature: <hex HMAC-SHA256 of the RAW request body, keyed by the endpoint secret>
 *   X-Sabsms-Timestamp: <epoch milliseconds at send time>
 *
 *   { "id": "<delivery id>", "kind": "message.delivered", "payload": {…}, "at": 1780000000000 }
 *
 * Retry policy: first attempt immediately on event, then backoff
 * [30s, 5m, 1h, 6h]. After the 5th failed attempt the delivery is
 * terminal (`failed` — the Phase-0 schema's name for failed_permanent).
 */

import { createHmac, randomInt } from 'node:crypto';

// ─── Signing ───────────────────────────────────────────────────────────────

export const SIGNATURE_HEADER = 'X-Sabsms-Signature';
export const TIMESTAMP_HEADER = 'X-Sabsms-Timestamp';

/** Hex HMAC-SHA256 of the raw body, keyed by the endpoint secret. */
export function signWebhookBody(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function signatureHeaders(
  secret: string,
  rawBody: string,
  at: number = Date.now(),
): Record<string, string> {
  return {
    [SIGNATURE_HEADER]: signWebhookBody(secret, rawBody),
    [TIMESTAMP_HEADER]: String(at),
  };
}

const SECRET_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Mint an endpoint secret (`whsec_` + 32 base62) — shown once. */
export function mintWebhookSecret(
  randomChar: () => string = () => SECRET_ALPHABET[randomInt(SECRET_ALPHABET.length)],
): string {
  let s = '';
  for (let i = 0; i < 32; i += 1) s += randomChar();
  return `whsec_${s}`;
}

// ─── Backoff schedule ──────────────────────────────────────────────────────

/** Retry delays AFTER a failed attempt: 30s, 5m, 1h, 6h. */
export const WEBHOOK_BACKOFF_MS = [
  30_000,
  5 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

/** 1 initial attempt + one per backoff step. */
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_BACKOFF_MS.length + 1;

/**
 * When should the NEXT attempt run, given `attemptsSoFar` completed
 * (failed) attempts? `null` = no further attempts (terminal failure).
 *
 *   attemptsSoFar=1 → now+30s, 2 → now+5m, 3 → now+1h, 4 → now+6h, 5 → null
 */
export function nextAttemptAt(attemptsSoFar: number, now: Date = new Date()): Date | null {
  if (attemptsSoFar < 1) return now;
  if (attemptsSoFar >= WEBHOOK_MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + WEBHOOK_BACKOFF_MS[attemptsSoFar - 1]);
}

// ─── Event naming + filtering + URL rules (client-safe half) ──────────────
// Live in ./events so client components can import the catalogue without
// dragging `node:crypto` into the browser bundle; re-exported here so
// server/worker code keeps one import surface.

export {
  PUBLIC_EVENT_NAMES,
  SUBSCRIBABLE_EVENTS,
  eventMatchesFilter,
  publicEventName,
  validateWebhookUrl,
} from './events';

// ─── Delivery payload ──────────────────────────────────────────────────────

export interface WebhookEventBody {
  /** Delivery id — stable across retries of the same delivery. */
  id: string;
  /** Public dotted event name. */
  kind: string;
  payload: Record<string, unknown>;
  /** Epoch ms the source event was stamped. */
  at: number;
}

export function buildEventBody(input: WebhookEventBody): string {
  return JSON.stringify({
    id: input.id,
    kind: input.kind,
    payload: input.payload,
    at: input.at,
  });
}
