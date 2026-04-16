/**
 * SabFlow — Stripe payment helper
 *
 * Thin wrapper around the Stripe REST API using `fetch` so that we don't have
 * to pull the Stripe Node SDK into the bundle. All calls are authenticated
 * with Basic auth using the secret key stored in a SabFlow credential.
 */

import 'server-only';

/* ── Types ──────────────────────────────────────────────────────────────── */

/** Currencies Stripe treats as zero-decimal (no sub-units). */
const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg',
  'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

export interface CreatePaymentIntentParams {
  /** Amount in the *major* currency unit (e.g. dollars, not cents). */
  amount: number;
  /** 3-letter ISO currency code, lowercased automatically. */
  currency: string;
  /** Optional description shown on the payment page. */
  description?: string;
  /** Stripe secret key (sk_live_… or sk_test_…). */
  secretKey: string;
  /** Arbitrary metadata attached to the PaymentIntent. */
  metadata?: Record<string, string>;
  /** Optional customer receipt email. */
  receiptEmail?: string;
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  /** Smallest currency unit amount that Stripe actually charged. */
  amount: number;
  currency: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Convert a human decimal amount into Stripe's smallest unit (e.g. cents).
 * Uses a ×100 multiplier for standard currencies and ×1 for zero-decimal ones.
 */
export function toStripeAmount(amount: number, currency: string): number {
  const code = currency.toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('toStripeAmount: amount must be a positive finite number');
  }
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

/**
 * Encode a plain object into `application/x-www-form-urlencoded` using the
 * bracket-notation Stripe expects (e.g. `metadata[key]=value`).
 */
function encodeStripeForm(
  body: Record<string, string | number | undefined | Record<string, string>>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (subValue === undefined) continue;
        params.append(`${key}[${subKey}]`, String(subValue));
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

interface StripePaymentIntentResponse {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

interface StripeErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Create a Stripe PaymentIntent and return the client secret so the browser
 * can confirm it with Stripe.js.
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<CreatePaymentIntentResult> {
  const { amount, currency, description, secretKey, metadata, receiptEmail } = params;

  if (!secretKey) {
    throw new Error('createPaymentIntent: missing Stripe secret key');
  }
  if (!currency || currency.length !== 3) {
    throw new Error('createPaymentIntent: currency must be a 3-letter ISO code');
  }

  const stripeAmount = toStripeAmount(amount, currency);

  const body: Record<string, string | number | Record<string, string>> = {
    amount: stripeAmount,
    currency: currency.toLowerCase(),
    'automatic_payment_methods[enabled]': 'true',
  };

  if (description) body.description = description;
  if (receiptEmail) body.receipt_email = receiptEmail;
  if (metadata && Object.keys(metadata).length > 0) body.metadata = metadata;

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      // Basic auth with secret key as the username and empty password.
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encodeStripeForm(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorBody: StripeErrorResponse | null = null;
    try {
      errorBody = (await response.json()) as StripeErrorResponse;
    } catch {
      /* ignore JSON parsing errors */
    }
    const message =
      errorBody?.error?.message ??
      `Stripe API error ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const data = (await response.json()) as StripePaymentIntentResponse;
  return {
    clientSecret: data.client_secret,
    paymentIntentId: data.id,
    amount: data.amount,
    currency: data.currency,
  };
}

/**
 * Retrieve a Stripe PaymentIntent by id.  Used by webhook handlers that want
 * to re-verify status before trusting the webhook body.
 */
export async function retrievePaymentIntent(
  paymentIntentId: string,
  secretKey: string,
): Promise<StripePaymentIntentResponse> {
  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    let errorBody: StripeErrorResponse | null = null;
    try {
      errorBody = (await response.json()) as StripeErrorResponse;
    } catch {
      /* ignore */
    }
    throw new Error(
      errorBody?.error?.message ??
        `Stripe API error ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as StripePaymentIntentResponse;
}

/**
 * Verify a Stripe webhook signature using the `Stripe-Signature` header.
 *
 * Follows the algorithm from
 * https://stripe.com/docs/webhooks/signatures#verify-manually — computes
 * `HMAC-SHA256(timestamp + "." + payload, webhookSecret)` and compares it in
 * constant time against each `v1=` signature scheme in the header.
 *
 * @param rawBody   The unparsed request body as read from the HTTP stream.
 * @param header    The raw `Stripe-Signature` header value.
 * @param secret    The webhook signing secret (whsec_…).
 * @param tolerance Maximum age of the timestamp in seconds (default 5m).
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  tolerance = 300,
): Promise<boolean> {
  if (!header || !secret) return false;

  const parts = header.split(',').map((p) => p.trim());
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1' && v) signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - ts) > tolerance) return false;

  // Use Node's crypto module via dynamic import so this file is safe to
  // tree-shake in contexts where the webhook handler isn't loaded.
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');

  for (const sig of signatures) {
    const sigBuf = Buffer.from(sig, 'utf8');
    if (sigBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(sigBuf, expectedBuf)) return true;
  }
  return false;
}
