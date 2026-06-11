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
  /* ── linkage to other entities (Razorpay parity) ──────────────────────── */
  orderId?: string;
  customerId?: string;
  paymentLinkId?: string;
  paymentPageId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  qrCodeId?: string;
  /* ── refunds / fees / dispute / settlement ─────────────────────────────── */
  amountRefunded?: number;        // paise; always present from Rust (defaults 0)
  refundStatus?: string;          // "partial" | "full"
  fee?: number;                   // paise
  tax?: number;                   // paise (GST on fee)
  disputeStatus?: string;         // "open" | "won" | "lost"
  settlementId?: string;
  createdAt: string;              // ISO
  paidAt?: string;                // ISO
}

/* ── Orders ──────────────────────────────────────────────────────────────── */

/** Razorpay-style `order_…` object. Mirrors `OrderOut` (entities/orders.rs). */
export interface SabpayOrder {
  id: string;                     // "order_<hex>"
  mode: SabpayMode;
  amount: number;                 // paise
  amountPaid: number;             // paise
  amountDue: number;              // paise
  currency: string;               // "INR"
  status: string;                 // "created" | "attempted" | "paid"
  receipt?: string;
  notes?: Record<string, unknown>;
  createdAt: string;              // ISO
  paidAt?: string;                // ISO
}

/* ── Refunds ─────────────────────────────────────────────────────────────── */

/** `rfnd_…` refund against a succeeded payment. Mirrors `RefundOut`. */
export interface SabpayRefund {
  id: string;                     // "rfnd_<hex>"
  mode: SabpayMode;
  paymentId: string;
  amount: number;                 // paise
  currency: string;               // "INR"
  status: string;                 // "pending" | "processed"
  reason?: string;
  notes?: Record<string, unknown>;
  settlementId?: string;
  createdAt: string;              // ISO
  processedAt?: string;           // ISO
}

/* ── Customers ───────────────────────────────────────────────────────────── */

/** `cust_…` customer object. Mirrors `CustomerOut` (entities/customers.rs). */
export interface SabpayCustomer {
  id: string;                     // "cust_<hex>"
  mode: SabpayMode;
  name: string;
  email?: string;
  contact?: string;
  gstin?: string;
  notes?: Record<string, unknown>;
  createdAt: string;              // ISO
}

/* ── Payment Links ───────────────────────────────────────────────────────── */

/** `plink_…` hosted payment link. Mirrors `PaymentLinkOut`. */
export interface SabpayPaymentLink {
  id: string;                     // "plink_<hex>"
  mode: SabpayMode;
  amount: number;                 // paise
  currency: string;               // "INR"
  status: string;                 // "created" | "paid" | "cancelled" | "expired"
  description?: string;
  referenceId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, unknown>;
  shortUrl: string;               // "<app>/pay/<plinkId>"
  expireBy?: string;              // ISO
  paymentId?: string;             // set once paid
  createdAt: string;              // ISO
  paidAt?: string;                // ISO
  cancelledAt?: string;           // ISO
}

/* ── Payment Pages ───────────────────────────────────────────────────────── */

/** A custom field on a payment page. Mirrors `PageField`. */
export interface SabpayPaymentPageField {
  key: string;
  label: string;
  type: string;                   // "text" | "email" | "phone" | "number"
  required: boolean;
}

/** `page_…` no-code hosted page. Mirrors `PaymentPageOut`. */
export interface SabpayPaymentPage {
  id: string;                     // "page_<hex>"
  mode: SabpayMode;
  title: string;
  description?: string;
  slug: string;
  amountType: string;             // "fixed" | "customer_decided"
  amount?: number;                // paise (fixed pages)
  minAmount?: number;             // paise (customer-decided pages)
  fields: SabpayPaymentPageField[];
  brandingImageUrl?: string;
  active: boolean;
  url: string;                    // "<app>/pay/<slug>"
  createdAt: string;              // ISO
}

/* ── Plans ───────────────────────────────────────────────────────────────── */

/** `plan_…` subscription-plan template. Mirrors `PlanOut`. */
export interface SabpayPlan {
  id: string;                     // "plan_<hex>"
  mode: SabpayMode;
  name: string;
  amount: number;                 // paise
  currency: string;               // "INR"
  interval: string;               // "daily" | "weekly" | "monthly" | "yearly"
  intervalCount: number;
  description?: string;
  notes?: Record<string, unknown>;
  createdAt: string;              // ISO
}

/* ── Subscriptions ───────────────────────────────────────────────────────── */

/** `sub_…` recurring-billing object. Mirrors `SubscriptionOut`. */
export interface SabpaySubscription {
  id: string;                     // "sub_<hex>"
  mode: SabpayMode;
  planId: string;
  customerId?: string;
  totalCount: number;
  paidCount: number;
  missedCycles: number;
  status: string;                 // created|authenticated|active|paused|halted|cancelled|completed
  nextChargeAt?: string;          // ISO
  cancelAtCycleEnd?: boolean;
  notes?: Record<string, unknown>;
  createdAt: string;              // ISO
  pausedAt?: string;              // ISO
  cancelledAt?: string;           // ISO
  endedAt?: string;               // ISO
}

/* ── Invoices ────────────────────────────────────────────────────────────── */

/** A line item on an invoice. Mirrors `LineItemOut`. */
export interface SabpayLineItem {
  name: string;
  description?: string;
  amount: number;                 // paise (per unit)
  quantity: number;
}

/** `inv_…` merchant-issued bill. Mirrors `InvoiceOut`. */
export interface SabpayInvoice {
  id: string;                     // "inv_<hex>"
  mode: SabpayMode;
  type: string;                   // "invoice" | "subscription_cycle"
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  lineItems: SabpayLineItem[];
  amount: number;                 // paise (computed total)
  currency: string;               // "INR"
  notes?: Record<string, unknown>;
  expireBy?: string;              // ISO
  status: string;                 // "draft" | "issued" | "paid" | "cancelled" | "expired"
  paymentId?: string;
  subscriptionId?: string;
  shortUrl?: string;              // hosted checkout, set on issue
  createdAt: string;              // ISO
  issuedAt?: string;              // ISO
  paidAt?: string;                // ISO
  cancelledAt?: string;           // ISO
}

/* ── QR Codes ────────────────────────────────────────────────────────────── */

/** `qr_…` UPI-style collect code. Mirrors `QrCodeOut`. */
export interface SabpayQrCode {
  id: string;                     // "qr_<hex>"
  mode: SabpayMode;
  name?: string;
  usage: string;                  // "single_use" | "multiple_use"
  fixedAmount: boolean;
  amount?: number;                // paise (fixed-amount QRs)
  description?: string;
  status: string;                 // "active" | "closed"
  payloadUrl: string;             // "<app>/pay/<qrId>"
  paymentsCountReceived: number;
  paymentsAmountReceived: number; // paise
  closedAt?: string;              // ISO
  createdAt: string;              // ISO
}

/* ── Settlements ─────────────────────────────────────────────────────────── */

/** `setl_…` payout object (read-only, always live mode). Mirrors `SettlementOut`. */
export interface SabpaySettlement {
  id: string;                     // "setl_<hex>"
  mode: SabpayMode;               // always "live"
  status: string;                 // "processed"
  grossAmount: number;            // paise
  feesTotal: number;              // paise
  taxTotal: number;               // paise
  refundsTotal: number;           // paise
  disputesDeducted: number;       // paise
  amount: number;                 // paise, net paid out
  paymentCount: number;
  refundCount: number;
  utr?: string;
  periodEnd?: string;             // ISO
  settledAt?: string;             // ISO
  createdAt: string;              // ISO
}

/* ── Disputes ────────────────────────────────────────────────────────────── */

/** Contest evidence on a dispute. Mirrors `DisputeEvidenceOut`. */
export interface SabpayDisputeEvidence {
  summary: string;
  fileUrls: string[];
}

/** `disp_…` chargeback object. Mirrors `DisputeOut`. */
export interface SabpayDispute {
  id: string;                     // "disp_<hex>"
  mode: SabpayMode;
  paymentId: string;
  amount: number;                 // paise
  currency: string;               // "INR"
  reasonCode: string;
  phase: string;                  // "chargeback"
  status: string;                 // "open" | "under_review" | "won" | "lost"
  respondBy: string;              // ISO
  evidence?: SabpayDisputeEvidence;
  evidenceSubmittedAt?: string;   // ISO
  createdAt: string;              // ISO
  resolvedAt?: string;            // ISO
}

/* ── Webhooks ────────────────────────────────────────────────────────────── */

/**
 * Full webhook event catalog — mirrors `WEBHOOK_EVENTS` in the Rust
 * `sabpay` crate's `store.rs`. Keep these in lock-step.
 */
export const SABPAY_WEBHOOK_EVENTS = [
  'payment.created',
  'payment.succeeded',
  'payment.failed',
  'order.paid',
  'refund.created',
  'refund.processed',
  'payment_link.paid',
  'payment_link.cancelled',
  'payment_link.expired',
  'invoice.issued',
  'invoice.paid',
  'invoice.cancelled',
  'invoice.expired',
  'subscription.activated',
  'subscription.pending',
  'subscription.charged',
  'subscription.paused',
  'subscription.resumed',
  'subscription.halted',
  'subscription.cancelled',
  'subscription.completed',
  'qr_code.credited',
  'qr_code.closed',
  'settlement.processed',
  'dispute.created',
  'dispute.under_review',
  'dispute.won',
  'dispute.lost',
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
  /** Object payload keyed by entity (`payment`, `refund`, `invoice`, …). */
  data: Record<string, unknown>;
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
  /** Entity kind of the delivered object (`payment`, `refund`, `invoice`, …). */
  objectType?: string;
  /** Public id of the delivered object (`pay_…`, `rfnd_…`, …). */
  objectId?: string;
  /** Stable event id, shared across redeliveries of the same event. */
  eventId?: string;
  /** When this row is a redelivery, the `_id` of the original delivery. */
  redeliveredFrom?: string;
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
