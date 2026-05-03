/**
 * Billing & Monetization — Shared Types
 *
 * Multi-tenant, plan-gated, credit-metered billing model. All monetary values are
 * stored as integer minor units (cents) unless explicitly noted to avoid floating
 * point drift across Stripe / Razorpay / PayU integrations.
 */

export type Currency =
    | 'USD'
    | 'EUR'
    | 'GBP'
    | 'INR'
    | 'AUD'
    | 'CAD'
    | 'SGD'
    | 'AED'
    | 'JPY';

export type BillingInterval = 'month' | 'year' | 'week' | 'day' | 'one_time';

/**
 * A meterable unit of consumption. Adding a new feature here requires updating
 * `entitlements.ts` to map plan -> caps for that feature.
 */
export type MeteredFeature =
    | 'messages_sent'
    | 'broadcasts'
    | 'contacts'
    | 'ai_tokens'
    | 'ai_requests'
    | 'storage_mb'
    | 'workflow_executions'
    | 'sms_segments'
    | 'email_sends'
    | 'voice_minutes'
    | 'api_calls'
    | 'seats'
    | 'projects';

/**
 * Append-only event recorded each time a tenant consumes a metered resource.
 * Stored in Mongo collection `usage_events`.
 */
export interface UsageEvent {
    _id?: string;
    tenantId: string;
    feature: MeteredFeature;
    units: number;
    /** ISO timestamp — when consumption occurred. */
    ts: string;
    /** Free-form metadata (request id, source, sub-feature). */
    meta?: Record<string, unknown>;
    /** Idempotency key to dedupe retried writes. */
    idempotencyKey?: string;
}

export interface PlanEntitlements {
    /** Hard caps. -1 means unlimited. 0 means feature disabled. */
    caps: Partial<Record<MeteredFeature, number>>;
    /** Boolean feature flags gated by plan tier. */
    features: Record<string, boolean>;
    /** Allowed seats; -1 unlimited. */
    seats: number;
    /** Whether tenant can purchase usage-based add-on packs. */
    overagePurchaseAllowed: boolean;
}

export interface Plan {
    id: string;
    name: string;
    description?: string;
    /** Price in minor units. */
    priceCents: number;
    currency: Currency;
    interval: BillingInterval;
    intervalCount?: number;
    trialDays?: number;
    entitlements: PlanEntitlements;
    /** Provider price IDs. */
    stripePriceId?: string;
    razorpayPlanId?: string;
    /** Display order for marketing pages. */
    sortOrder?: number;
    archived?: boolean;
}

export type SubscriptionStatus =
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'paused';

export interface Subscription {
    _id?: string;
    tenantId: string;
    planId: string;
    status: SubscriptionStatus;
    /** ISO timestamp. */
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    canceledAt?: string;
    trialEndsAt?: string;
    provider: 'stripe' | 'razorpay' | 'payu' | 'manual';
    providerSubscriptionId?: string;
    /** On-demand entitlement overrides (e.g. addon packs). */
    addons?: Array<{ feature: MeteredFeature; units: number; expiresAt?: string }>;
}

export interface LineItem {
    description: string;
    quantity: number;
    /** Unit price in minor units. */
    unitPriceCents: number;
    /** quantity * unitPriceCents (cached for ledger integrity). */
    amountCents: number;
    /** If line is for metered usage, the corresponding feature. */
    feature?: MeteredFeature;
    /** Period covered by this line item (for ASC 606 recognition). */
    periodStart?: string;
    periodEnd?: string;
    /** Tax breakdown for this line. */
    taxCents?: number;
}

export type InvoiceStatus =
    | 'draft'
    | 'open'
    | 'paid'
    | 'uncollectible'
    | 'void'
    | 'past_due';

export interface Invoice {
    _id?: string;
    tenantId: string;
    number: string;
    status: InvoiceStatus;
    currency: Currency;
    subtotalCents: number;
    taxCents: number;
    discountCents: number;
    totalCents: number;
    amountPaidCents: number;
    amountDueCents: number;
    issuedAt: string;
    dueAt: string;
    paidAt?: string;
    voidedAt?: string;
    lineItems: LineItem[];
    couponCode?: string;
    /** Provider invoice id (Stripe/Razorpay). */
    providerInvoiceId?: string;
    /** Period this invoice represents — used by RevRec. */
    periodStart?: string;
    periodEnd?: string;
}

export type CouponDuration = 'once' | 'repeating' | 'forever';

export interface Coupon {
    code: string;
    name?: string;
    /** Either percentOff OR amountOffCents — never both. */
    percentOff?: number;
    amountOffCents?: number;
    currency?: Currency;
    duration: CouponDuration;
    durationInMonths?: number;
    maxRedemptions?: number;
    timesRedeemed?: number;
    expiresAt?: string;
    /** Restrict to specific plan ids. */
    appliesToPlanIds?: string[];
    active: boolean;
}

/**
 * ASC 606 revenue recognition record. Created when an invoice is issued and
 * "consumed" daily/monthly as the obligation is fulfilled.
 */
export interface RevenueRecognition {
    _id?: string;
    invoiceId: string;
    tenantId: string;
    lineItemIndex: number;
    /** Total contract value being recognized over the schedule. */
    totalCents: number;
    currency: Currency;
    /** Date the obligation begins. */
    periodStart: string;
    periodEnd: string;
    /** Cents already recognized. */
    recognizedCents: number;
    /** Cents waiting to be recognized in future periods. */
    deferredCents: number;
    /** Schedule cadence. */
    method: 'ratable_daily' | 'ratable_monthly' | 'point_in_time';
    /** Ledger entries — one per recognition event. */
    schedule: Array<{ date: string; amountCents: number; recognized: boolean }>;
}

export interface PartnerCommission {
    _id?: string;
    /** SabNode partner / referrer / developer id. */
    partnerId: string;
    tenantId: string;
    invoiceId: string;
    /** Commission earned in minor units. */
    amountCents: number;
    currency: Currency;
    /** Commission rate that produced amountCents (0..1). */
    rate: number;
    /** Stripe Connect transfer id once paid out. */
    transferId?: string;
    status: 'pending' | 'approved' | 'paid' | 'reversed' | 'rejected';
    earnedAt: string;
    paidAt?: string;
}

export type BillingPeriod = {
    /** Inclusive ISO. */
    start: string;
    /** Exclusive ISO. */
    end: string;
};
