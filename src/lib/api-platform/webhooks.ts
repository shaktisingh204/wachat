/**
 * SabNode Developer Platform — outbound webhook delivery.
 *
 *   signPayload(secret, body)  → "sha256=<hex>"
 *   deliverWebhook(url, payload, opts?) → WebhookDelivery
 *
 * Signing is HMAC-SHA-256 over the canonical JSON string of the payload
 * (or the verbatim string if a string was passed in).  The signature
 * is conveyed in the `X-SabNode-Signature` request header so receivers
 * can verify authenticity without reading the body twice.
 *
 * Delivery uses fetch with retry+exponential backoff:
 *   attempt n delay = baseDelayMs * 2^(n-1) (capped at 30s)
 *   default: 5 attempts → 0.5s, 1s, 2s, 4s, 8s gaps
 */

import 'server-only';

import { createHmac, randomUUID } from 'node:crypto';
import type { WebhookDelivery } from './types';

/* ── Signing ─────────────────────────────────────────────────────────────── */

/**
 * Produce a deterministic HMAC SHA-256 signature for `body` using `secret`.
 * The body is serialised with stable JSON when an object is passed in.
 *
 * Format: `sha256=<hex>` (Stripe-style, easy for SDKs to parse).
 */
export function signPayload(secret: string, body: unknown): string {
  if (!secret) throw new Error('signPayload: secret is required');
  const message = typeof body === 'string' ? body : JSON.stringify(body ?? null);
  const digest = createHmac('sha256', secret).update(message, 'utf8').digest('hex');
  return `sha256=${digest}`;
}

/**
 * Constant-time signature verification helper.  Returns `true` when
 * `signature` matches what `signPayload(secret, body)` would produce.
 */
export function verifySignature(secret: string, body: unknown, signature: string): boolean {
  const expected = signPayload(secret, body);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

/* ── Delivery ────────────────────────────────────────────────────────────── */

export interface DeliverOptions {
  /** Shared secret used to sign the body.  Optional — when absent, no
   *  signature header is sent (useful for non-authenticated test sinks). */
  secret?: string;
  /** Event name copied into `X-SabNode-Event`. */
  event?: string;
  /** Owning tenant id for bookkeeping; copied into the returned delivery. */
  tenantId?: string;
  /** Webhook id for bookkeeping; copied into the returned delivery. */
  webhookId?: string;
  /** Total number of attempts (must be ≥ 1). Default 5. */
  maxAttempts?: number;
  /** First backoff delay in ms.  Default 500ms. */
  baseDelayMs?: number;
  /** Per-attempt timeout in ms.  Default 10s. */
  timeoutMs?: number;
}

const DEFAULTS = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  timeoutMs: 10_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attempt: number, base: number): number {
  // attempt is 1-based; first retry waits `base`, then doubles.
  const delay = base * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(delay, DEFAULTS.maxDelayMs);
}

/**
 * Determine whether to retry given the response status code.
 * 408, 429, and 5xx are retryable; everything else is terminal.
 */
function isRetryable(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

async function attemptOnce(
  url: string,
  body: string,
  signature: string | null,
  event: string | undefined,
  timeoutMs: number,
): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'SabNode-Webhooks/1.0',
      'x-sabnode-delivery': randomUUID(),
    };
    if (signature) headers['x-sabnode-signature'] = signature;
    if (event) headers['x-sabnode-event'] = event;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, body: text.slice(0, 4096) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deliver `payload` to `url`, retrying with exponential backoff on
 * transport errors and retryable status codes.  Always resolves — never
 * throws — and returns a `WebhookDelivery` describing the outcome.
 */
export async function deliverWebhook(
  url: string,
  payload: unknown,
  opts: DeliverOptions = {},
): Promise<WebhookDelivery> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULTS.maxAttempts);
  const baseDelay = Math.max(1, opts.baseDelayMs ?? DEFAULTS.baseDelayMs);
  const timeoutMs = Math.max(100, opts.timeoutMs ?? DEFAULTS.timeoutMs);

  const body = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
  const signature = opts.secret ? signPayload(opts.secret, body) : null;

  const startedAt = new Date().toISOString();
  let attempts = 0;
  let lastStatus: number | null = null;
  let lastBody: string | undefined;
  let lastError: string | undefined;
  let success = false;

  for (let i = 1; i <= maxAttempts; i++) {
    attempts = i;
    try {
      const { status, body: respBody } = await attemptOnce(url, body, signature, opts.event, timeoutMs);
      lastStatus = status;
      lastBody = respBody;
      lastError = undefined;
      if (status >= 200 && status < 300) {
        success = true;
        break;
      }
      if (!isRetryable(status) || i === maxAttempts) break;
    } catch (err) {
      lastStatus = null;
      lastError = err instanceof Error ? err.message : String(err);
      if (i === maxAttempts) break;
    }
    await sleep(backoff(i, baseDelay));
  }

  return {
    id: randomUUID(),
    webhookId: opts.webhookId ?? '',
    tenantId: opts.tenantId ?? '',
    event: opts.event ?? '',
    payload,
    responseStatus: lastStatus,
    responseBody: lastBody,
    attempts,
    success,
    error: lastError,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
