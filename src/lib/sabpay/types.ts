/**
 * SabPay — shared, framework-neutral types + event vocabulary.
 *
 * This module is imported by BOTH Client Components (dashboard UI) and
 * server modules, so it must stay free of Mongo / node:crypto imports.
 * Server-only shapes live in `db.server.ts` / `webhooks.server.ts`.
 */

/* ── Modes ───────────────────────────────────────────────────────────────── */

/** Test payments never touch PayU — they finalize via the simulator. */
export type SabpayMode = 'test' | 'live';

/* ── Payments ────────────────────────────────────────────────────────────── */

export type SabpayPaymentStatus =
  | 'created'    // session created via API, checkout not finished
  | 'succeeded'  // PayU confirmed (or test simulator succeeded)
  | 'failed';    // PayU declined / customer cancelled / simulator failed

/** Client-facing payment shape (all ids are strings, amounts in paise). */
export interface SabpayPayment {
  id: string;                     // "pay_<hex>"
  mode: SabpayMode;
  status: SabpayPaymentStatus;
  amount: number;                 // smallest currency unit (paise)
  currency: string;               // "INR" (PayU)
  description: string;
  customer: {
    name?: string;
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
  checkoutUrl: string;            // hosted page on SabNode
  provider: 'payu';
  providerTxnId?: string;         // PayU txnid we generated
  providerPaymentId?: string;     // PayU mihpayid
  providerMeta?: {
    paymentMode?: string;         // CC / NB / UPI…
    bankRefNum?: string;
    errorMessage?: string;
  };
  failureReason?: string;
  createdAt: string;              // ISO
  paidAt?: string;                // ISO
}

/* ── Webhooks ────────────────────────────────────────────────────────────── */

export const SABPAY_WEBHOOK_EVENTS = [
  'payment.created',
  'payment.succeeded',
  'payment.failed',
] as const;

export type SabpayWebhookEvent = (typeof SABPAY_WEBHOOK_EVENTS)[number];

export function isSabpayWebhookEvent(v: unknown): v is SabpayWebhookEvent {
  return (
    typeof v === 'string' &&
    (SABPAY_WEBHOOK_EVENTS as readonly string[]).includes(v)
  );
}

/** Envelope POSTed to merchant endpoints, signed in `X-SabPay-Signature`. */
export interface SabpayWebhookEnvelope {
  id: string;                     // delivery id "evt_<hex>"
  event: SabpayWebhookEvent;
  mode: SabpayMode;
  timestamp: string;              // ISO
  data: { payment: SabpayPayment };
}

/** Client-facing webhook endpoint (secret redacted except on create/rotate). */
export interface SabpayWebhookEndpoint {
  _id: string;
  url: string;
  events: SabpayWebhookEvent[];
  description?: string;
  active: boolean;
  failureCount: number;
  lastDeliveryAt?: string;
  lastStatus?: number | null;
  lastError?: string;
  /** Present exactly once, on create / rotate. */
  secret?: string;
  hasSecret: boolean;
  createdAt: string;
}

/** A logged delivery attempt shown in the dashboard. */
export interface SabpayWebhookDelivery {
  _id: string;
  endpointId: string;
  url: string;
  event: SabpayWebhookEvent;
  paymentId: string;
  success: boolean;
  status: number | null;
  attempts: number;
  error?: string;
  createdAt: string;
}

/* ── API keys ────────────────────────────────────────────────────────────── */

/** Client-facing API key (the secret is shown exactly once, at creation). */
export interface SabpayApiKey {
  _id: string;
  name: string;
  mode: SabpayMode;
  /** e.g. "sk_test_…a1b2" — prefix + last 4, for display. */
  display: string;
  revoked: boolean;
  lastUsedAt?: string;
  createdAt: string;
  /** Present exactly once, on create. */
  secret?: string;
}

/* ── Merchant settings ───────────────────────────────────────────────────── */

export interface SabpayMerchant {
  businessName: string;
  logoUrl?: string;
  brandColor?: string;            // hex, used on the hosted checkout accent
  mode: SabpayMode;               // dashboard's active mode toggle
  defaultCurrency: string;        // "INR"
  createdAt: string;
}

/* ── Overview stats ──────────────────────────────────────────────────────── */

export interface SabpayStats {
  totalVolume: number;            // paise, succeeded only
  totalCount: number;
  succeededCount: number;
  failedCount: number;
  createdCount: number;
  successRate: number;            // 0..100, of finished payments
  /** Last 14 days of succeeded volume, oldest first. */
  series: Array<{ date: string; volume: number; count: number }>;
}

/* ── Formatting helper (client-safe) ─────────────────────────────────────── */

export function formatSabpayAmount(paise: number, currency = 'INR'): string {
  const major = paise / 100;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: major % 1 === 0 ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
