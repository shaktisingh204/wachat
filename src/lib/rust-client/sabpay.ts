/**
 * Client for the **SabPay** payment-gateway router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/sabpay` by the `sabpay` crate
 * (`rust/crates/sabpay`). The Rust side owns every SabPay Mongo collection and
 * all of its logic (merchants, payments + PayU SHA-512 signing, secret keys,
 * webhook endpoints + HMAC delivery), so this client is a thin transport.
 *
 * Three auth modes:
 *   - dashboard methods use {@link rustFetch} (the session cookie identifies
 *     the merchant);
 *   - `*As` methods use {@link rustFetchAs} (the public API resolves the
 *     merchant from a secret `sk_…` key, then acts as that user id);
 *   - `public*` methods use {@link rustFetchPublic} (the unguessable payment
 *     id is the capability — no principal).
 */
import 'server-only';

import { rustFetch, rustFetchAs, rustFetchPublic, rustFetchText } from './fetcher';
import type {
    SabpayApiKey,
    SabpayCustomer,
    SabpayDispute,
    SabpayInvoice,
    SabpayLineItem,
    SabpayMerchant,
    SabpayMode,
    SabpayOrder,
    SabpayPayment,
    SabpayPaymentLink,
    SabpayPaymentPage,
    SabpayPaymentPageField,
    SabpayPaymentStatus,
    SabpayPlan,
    SabpayQrCode,
    SabpayRefund,
    SabpaySettlement,
    SabpayStats,
    SabpaySubscription,
    SabpayWebhookDelivery,
    SabpayWebhookEndpoint,
    SabpayWebhookEvent,
} from '@/lib/sabpay/types';

const BASE = '/v1/sabpay';

/* ── idempotency header helper ───────────────────────────────────────────── */

/**
 * Build the optional `idempotency-key` header. Returns `undefined` when no key
 * is supplied so the spread in `rustFetch*` leaves headers untouched.
 */
function idemHeaders(key?: string): Record<string, string> | undefined {
    return key ? { 'idempotency-key': key } : undefined;
}

/* ── response envelopes the Rust handlers return ─────────────────────────── */

export interface SabpayOverview {
    merchant: SabpayMerchant;
    stats: SabpayStats;
    recent: SabpayPayment[];
}

export interface SabpayPaymentsList {
    merchant: SabpayMerchant;
    payments: SabpayPayment[];
}

export interface SabpayWebhookData {
    endpoints: SabpayWebhookEndpoint[];
    deliveries: SabpayWebhookDelivery[];
}

/** Hosted-checkout view (`GET /public/payments/:id`). */
export interface SabpayCheckoutView {
    paymentId: string;
    mode: SabpayMode;
    status: SabpayPaymentStatus;
    amount: number;
    currency: string;
    description: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    successUrl?: string;
    cancelUrl?: string;
    failureReason?: string;
    business: { name: string; logoUrl?: string; brandColor: string };
}

/** Signed PayU form the browser auto-submits. */
export interface SabpayPayuSession {
    action: string;
    fields: Record<string, string>;
}

/** Result of finalizing a payment (simulate / callback). */
export interface SabpayFinalizeResult {
    status: SabpayPaymentStatus;
    paymentId: string;
    redirectUrl?: string;
}

/* ── request payloads ────────────────────────────────────────────────────── */

export interface SabpayUpdateMerchantBody {
    businessName?: string;
    logoUrl?: string;
    brandColor?: string;
    mode?: SabpayMode;
}

export interface SabpayCreatePaymentBody {
    amount: number;
    currency?: string;
    description?: string;
    customer?: { name?: string; email?: string; phone?: string };
    metadata?: Record<string, string>;
    successUrl?: string;
    cancelUrl?: string;
    /** Set by the public API from the key prefix; omitted by the dashboard. */
    mode?: SabpayMode;
}

export interface SabpayListPaymentsQuery {
    mode?: SabpayMode;
    status?: SabpayPaymentStatus;
    before?: string;
    limit?: number;
}

function paymentsQs(q: SabpayListPaymentsQuery): string {
    const sp = new URLSearchParams();
    if (q.mode) sp.set('mode', q.mode);
    if (q.status) sp.set('status', q.status);
    if (q.before) sp.set('before', q.before);
    if (q.limit != null) sp.set('limit', String(q.limit));
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/* ── shared list-query shapes + helpers ──────────────────────────────────── */

/** `{mode, before, limit}` — the cursor-paginated list query most entities take. */
export interface SabpayListQuery {
    mode?: SabpayMode;
    before?: string;
    limit?: number;
}

/** `{mode, status, before, limit}` — list query for entities with a status filter. */
export interface SabpayStatusListQuery extends SabpayListQuery {
    status?: string;
}

function listQs(q: SabpayListQuery): string {
    const sp = new URLSearchParams();
    if (q.mode) sp.set('mode', q.mode);
    if (q.before) sp.set('before', q.before);
    if (q.limit != null) sp.set('limit', String(q.limit));
    const s = sp.toString();
    return s ? `?${s}` : '';
}

function statusListQs(q: SabpayStatusListQuery): string {
    const sp = new URLSearchParams();
    if (q.mode) sp.set('mode', q.mode);
    if (q.status) sp.set('status', q.status);
    if (q.before) sp.set('before', q.before);
    if (q.limit != null) sp.set('limit', String(q.limit));
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/* ── Orders ──────────────────────────────────────────────────────────────── */

export interface SabpayCreateOrderBody {
    amount: number;                 // paise
    currency?: string;
    receipt?: string;
    notes?: Record<string, unknown>;
    /** Set by the public API from the key prefix; the dashboard omits it. */
    mode?: SabpayMode;
}
export interface SabpayUpdateOrderBody {
    notes?: Record<string, unknown>;
}
export interface SabpayOrdersList {
    orders: SabpayOrder[];
}
export interface SabpayPaymentsArrayList {
    payments: SabpayPayment[];
}

/* ── Refunds ─────────────────────────────────────────────────────────────── */

export interface SabpayCreateRefundBody {
    /** Omit for a full refund of the remaining amount. */
    amount?: number;                // paise
    reason?: string;
    notes?: Record<string, unknown>;
}
export interface SabpayRefundsList {
    refunds: SabpayRefund[];
}

/* ── Customers ───────────────────────────────────────────────────────────── */

export interface SabpayCreateCustomerBody {
    name: string;
    email?: string;
    contact?: string;
    gstin?: string;
    notes?: Record<string, unknown>;
    mode?: SabpayMode;
}
export type SabpayUpdateCustomerBody = Partial<Omit<SabpayCreateCustomerBody, 'mode'>>;
export interface SabpayCustomerListQuery extends SabpayListQuery {
    search?: string;
}
export interface SabpayCustomersList {
    customers: SabpayCustomer[];
}

function customerListQs(q: SabpayCustomerListQuery): string {
    const sp = new URLSearchParams();
    if (q.mode) sp.set('mode', q.mode);
    if (q.search) sp.set('search', q.search);
    if (q.before) sp.set('before', q.before);
    if (q.limit != null) sp.set('limit', String(q.limit));
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/* ── Payment Links ───────────────────────────────────────────────────────── */

export interface SabpayCreatePaymentLinkBody {
    amount: number;                 // paise
    currency?: string;
    description?: string;
    referenceId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    expireBy?: string;              // ISO
    notes?: Record<string, unknown>;
    mode?: SabpayMode;
}
export interface SabpayUpdatePaymentLinkBody {
    referenceId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    expireBy?: string;
    notes?: Record<string, unknown>;
}
export interface SabpayPaymentLinksList {
    paymentLinks: SabpayPaymentLink[];
}
/** Payer-facing link view (`GET /public/links/{id}`). */
export interface SabpayPublicLinkView {
    plinkId: string;
    status: string;
    amount: number;
    currency: string;
    description?: string;
    business: { name: string; logoUrl?: string; brandColor: string };
    mode: SabpayMode;
}
/** Session result for link/page/QR checkout starts. */
export interface SabpaySessionResult {
    checkoutUrl: string;
    paymentId: string;
}

/* ── Payment Pages ───────────────────────────────────────────────────────── */

export interface SabpayCreatePaymentPageBody {
    title: string;
    description?: string;
    slug: string;
    amountType: string;             // "fixed" | "customer_decided"
    amount?: number;                // paise (fixed)
    minAmount?: number;             // paise (customer_decided)
    fields?: SabpayPaymentPageField[];
    brandingImageUrl?: string;
    mode?: SabpayMode;
}
export interface SabpayUpdatePaymentPageBody {
    title?: string;
    description?: string;
    amount?: number;
    minAmount?: number;
    fields?: SabpayPaymentPageField[];
    brandingImageUrl?: string;
    active?: boolean;
}
export interface SabpayPaymentPagesList {
    pages: SabpayPaymentPage[];
}
export interface SabpaySlugAvailable {
    available: boolean;
}
/** Payer-facing page view (`GET /public/pages/{slug}`). */
export interface SabpayPublicPageView {
    mode: SabpayMode;
    title: string;
    description?: string;
    slug: string;
    amountType: string;
    amount?: number;
    minAmount?: number;
    fields: SabpayPaymentPageField[];
    brandingImageUrl?: string;
    business: { name: string; logoUrl?: string; brandColor: string };
}
export interface SabpayPageSessionBody {
    amount?: number;                // paise (customer_decided pages)
    fields?: Record<string, string>;
}

/* ── Plans ───────────────────────────────────────────────────────────────── */

export interface SabpayCreatePlanBody {
    name: string;
    amount: number;                 // paise
    currency?: string;
    interval: string;               // daily|weekly|monthly|yearly
    intervalCount?: number;
    description?: string;
    notes?: Record<string, unknown>;
    mode?: SabpayMode;
}
export interface SabpayPlansList {
    plans: SabpayPlan[];
}

/* ── Subscriptions ───────────────────────────────────────────────────────── */

export interface SabpayCreateSubscriptionBody {
    planId: string;
    customerId?: string;
    totalCount: number;
    startAt?: string;               // ISO; first charge, defaults to now
    notes?: Record<string, unknown>;
    mode?: SabpayMode;
}
export interface SabpayUpdateSubscriptionBody {
    notes?: Record<string, unknown>;
    /** May only be *increased*. */
    totalCount?: number;
}
export interface SabpaySubscriptionsList {
    subscriptions: SabpaySubscription[];
}

/* ── Invoices ────────────────────────────────────────────────────────────── */

export interface SabpayInvoiceLineItemInput {
    name: string;
    description?: string;
    amount: number;                 // paise (per unit)
    quantity?: number;              // defaults to 1
}
export interface SabpayCreateInvoiceBody {
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    lineItems: SabpayInvoiceLineItemInput[];
    currency?: string;
    notes?: Record<string, unknown>;
    expireBy?: string;              // ISO
    mode?: SabpayMode;
}
export interface SabpayUpdateInvoiceBody {
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    lineItems?: SabpayInvoiceLineItemInput[];
    notes?: Record<string, unknown>;
    expireBy?: string;
}
export interface SabpayInvoicesList {
    invoices: SabpayInvoice[];
}

/* ── QR Codes ────────────────────────────────────────────────────────────── */

export interface SabpayCreateQrCodeBody {
    name?: string;
    usage: string;                  // "single_use" | "multiple_use"
    fixedAmount?: boolean;
    amount?: number;                // paise (required when fixedAmount)
    description?: string;
    mode?: SabpayMode;
}
export interface SabpayQrCodesList {
    qrCodes: SabpayQrCode[];
}
/** Payer-facing QR view (`GET /public/qr/{id}`). */
export interface SabpayPublicQrView {
    qrId: string;
    status: string;
    fixedAmount: boolean;
    amount?: number;
    description?: string;
    business: { name: string; logoUrl?: string; brandColor: string };
    mode: SabpayMode;
}
export interface SabpayQrSessionBody {
    amount?: number;                // paise (open-amount QRs)
    description?: string;
}

/* ── Settlements ─────────────────────────────────────────────────────────── */

export interface SabpaySettlementsList {
    settlements: SabpaySettlement[];
}
export interface SabpaySettlementSummary {
    nextAmount: number;             // paise
    eligibleCount: number;
    lastSettledAt?: string;         // ISO
}
/** Compact refund row in a settlement detail. */
export interface SabpaySettlementRefund {
    id: string;
    amount: number;
    paymentId: string;
}
export interface SabpaySettlementDetail {
    settlement: SabpaySettlement;
    payments: SabpayPayment[];
    refunds: SabpaySettlementRefund[];
}

/* ── Disputes ────────────────────────────────────────────────────────────── */

export interface SabpayDisputesList {
    disputes: SabpayDispute[];
}
export interface SabpayContestDisputeBody {
    summary: string;
    fileUrls?: string[];
}
export interface SabpayCreateTestDisputeBody {
    paymentId: string;
    reasonCode?: string;
    amount?: number;                // paise
    outcome?: 'won' | 'lost';
}

/* ── Webhook deliveries ──────────────────────────────────────────────────── */

export interface SabpayWebhookDeliveryQuery {
    endpointId?: string;
    event?: SabpayWebhookEvent;
    success?: boolean;
    before?: string;
    limit?: number;
}

function deliveryQs(q: SabpayWebhookDeliveryQuery): string {
    const sp = new URLSearchParams();
    if (q.endpointId) sp.set('endpointId', q.endpointId);
    if (q.event) sp.set('event', q.event);
    if (q.success != null) sp.set('success', String(q.success));
    if (q.before) sp.set('before', q.before);
    if (q.limit != null) sp.set('limit', String(q.limit));
    const s = sp.toString();
    return s ? `?${s}` : '';
}

/* ── CSV exports ─────────────────────────────────────────────────────────── */

export type SabpayExportEntity = 'payments' | 'refunds' | 'orders' | 'settlements';

export interface SabpayExportQuery {
    mode?: SabpayMode;
    from?: string;                  // ISO
    to?: string;                    // ISO
}

function exportQs(q: SabpayExportQuery): string {
    const sp = new URLSearchParams();
    if (q.mode) sp.set('mode', q.mode);
    if (q.from) sp.set('from', q.from);
    if (q.to) sp.set('to', q.to);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabpayApi = {
    /* ── dashboard (session-authed) ──────────────────────────────────────── */
    getOverview: () => rustFetch<SabpayOverview>(`${BASE}/overview`),
    getMerchant: () => rustFetch<SabpayMerchant>(`${BASE}/merchant`),
    updateMerchant: (patch: SabpayUpdateMerchantBody) =>
        rustFetch<SabpayMerchant>(`${BASE}/merchant`, {
            method: 'PUT',
            body: JSON.stringify(patch),
        }),
    getStats: () => rustFetch<SabpayStats>(`${BASE}/stats`),

    listPayments: (q: SabpayListPaymentsQuery = {}) =>
        rustFetch<SabpayPaymentsList>(`${BASE}/payments${paymentsQs(q)}`),
    createPayment: (body: SabpayCreatePaymentBody) =>
        rustFetch<SabpayPayment>(`${BASE}/payments`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    getPayment: (id: string) =>
        rustFetch<SabpayPayment>(`${BASE}/payments/${encodeURIComponent(id)}`),

    listKeys: () => rustFetch<SabpayApiKey[]>(`${BASE}/keys`),
    createKey: (body: { name: string; mode: SabpayMode }) =>
        rustFetch<SabpayApiKey>(`${BASE}/keys`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    revokeKey: (id: string) =>
        rustFetch<{ success: boolean }>(`${BASE}/keys/${encodeURIComponent(id)}/revoke`, {
            method: 'POST',
        }),

    getWebhookData: () => rustFetch<SabpayWebhookData>(`${BASE}/webhooks`),
    createWebhook: (body: {
        url: string;
        events: SabpayWebhookEvent[];
        description?: string;
    }) =>
        rustFetch<SabpayWebhookEndpoint>(`${BASE}/webhooks`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    updateWebhook: (
        id: string,
        patch: {
            url?: string;
            events?: SabpayWebhookEvent[];
            description?: string;
            active?: boolean;
        },
    ) =>
        rustFetch<SabpayWebhookEndpoint>(`${BASE}/webhooks/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    rotateWebhook: (id: string) =>
        rustFetch<SabpayWebhookEndpoint>(`${BASE}/webhooks/${encodeURIComponent(id)}/rotate`, {
            method: 'POST',
        }),
    deleteWebhook: (id: string) =>
        rustFetch<{ success: boolean }>(`${BASE}/webhooks/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),

    /* ── act-as-merchant (public API key path) ───────────────────────────── */
    createPaymentAs: (userId: string, body: SabpayCreatePaymentBody) =>
        rustFetchAs<SabpayPayment>(userId, `${BASE}/payments`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    listPaymentsAs: (userId: string, q: SabpayListPaymentsQuery = {}) =>
        rustFetchAs<SabpayPaymentsList>(userId, `${BASE}/payments${paymentsQs(q)}`),
    getPaymentAs: (userId: string, id: string) =>
        rustFetchAs<SabpayPayment>(userId, `${BASE}/payments/${encodeURIComponent(id)}`),

    /* ── public (id-capability, no principal) ────────────────────────────── */
    getCheckout: (paymentId: string) =>
        rustFetchPublic<SabpayCheckoutView>(
            `${BASE}/public/payments/${encodeURIComponent(paymentId)}`,
        ),
    payuSession: (
        paymentId: string,
        body: { name: string; email: string; phone: string },
    ) =>
        rustFetchPublic<SabpayPayuSession>(
            `${BASE}/public/payments/${encodeURIComponent(paymentId)}/payu-session`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
    simulate: (
        paymentId: string,
        body: { outcome: 'success' | 'failure'; name?: string; email?: string },
    ) =>
        rustFetchPublic<SabpayFinalizeResult>(
            `${BASE}/public/payments/${encodeURIComponent(paymentId)}/simulate`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
    payuCallback: (fields: Record<string, string>) =>
        rustFetchPublic<SabpayFinalizeResult>(`${BASE}/public/payu-callback`, {
            method: 'POST',
            body: JSON.stringify(fields),
        }),

    /* ════════════════════════════════════════════════════════════════════════
     * Orders
     * ══════════════════════════════════════════════════════════════════════ */
    listOrders: (q: SabpayStatusListQuery = {}) =>
        rustFetch<SabpayOrdersList>(`${BASE}/orders${statusListQs(q)}`),
    createOrder: (body: SabpayCreateOrderBody, idempotencyKey?: string) =>
        rustFetch<SabpayOrder>(`${BASE}/orders`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getOrder: (id: string) =>
        rustFetch<SabpayOrder>(`${BASE}/orders/${encodeURIComponent(id)}`),
    updateOrder: (id: string, patch: SabpayUpdateOrderBody) =>
        rustFetch<SabpayOrder>(`${BASE}/orders/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    getOrderPayments: (id: string) =>
        rustFetch<SabpayPaymentsArrayList>(
            `${BASE}/orders/${encodeURIComponent(id)}/payments`,
        ),

    listOrdersAs: (userId: string, q: SabpayStatusListQuery = {}) =>
        rustFetchAs<SabpayOrdersList>(userId, `${BASE}/orders${statusListQs(q)}`),
    createOrderAs: (userId: string, body: SabpayCreateOrderBody, idempotencyKey?: string) =>
        rustFetchAs<SabpayOrder>(userId, `${BASE}/orders`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getOrderAs: (userId: string, id: string) =>
        rustFetchAs<SabpayOrder>(userId, `${BASE}/orders/${encodeURIComponent(id)}`),
    updateOrderAs: (userId: string, id: string, patch: SabpayUpdateOrderBody) =>
        rustFetchAs<SabpayOrder>(userId, `${BASE}/orders/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    getOrderPaymentsAs: (userId: string, id: string) =>
        rustFetchAs<SabpayPaymentsArrayList>(
            userId,
            `${BASE}/orders/${encodeURIComponent(id)}/payments`,
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * Refunds
     * ══════════════════════════════════════════════════════════════════════ */
    listRefunds: (q: SabpayStatusListQuery = {}) =>
        rustFetch<SabpayRefundsList>(`${BASE}/refunds${statusListQs(q)}`),
    getRefund: (id: string) =>
        rustFetch<SabpayRefund>(`${BASE}/refunds/${encodeURIComponent(id)}`),
    listPaymentRefunds: (paymentId: string) =>
        rustFetch<SabpayRefundsList>(
            `${BASE}/payments/${encodeURIComponent(paymentId)}/refunds`,
        ),
    createRefund: (paymentId: string, body: SabpayCreateRefundBody = {}, idempotencyKey?: string) =>
        rustFetch<SabpayRefund>(`${BASE}/payments/${encodeURIComponent(paymentId)}/refunds`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),

    listRefundsAs: (userId: string, q: SabpayStatusListQuery = {}) =>
        rustFetchAs<SabpayRefundsList>(userId, `${BASE}/refunds${statusListQs(q)}`),
    getRefundAs: (userId: string, id: string) =>
        rustFetchAs<SabpayRefund>(userId, `${BASE}/refunds/${encodeURIComponent(id)}`),
    listPaymentRefundsAs: (userId: string, paymentId: string) =>
        rustFetchAs<SabpayRefundsList>(
            userId,
            `${BASE}/payments/${encodeURIComponent(paymentId)}/refunds`,
        ),
    createRefundAs: (
        userId: string,
        paymentId: string,
        body: SabpayCreateRefundBody = {},
        idempotencyKey?: string,
    ) =>
        rustFetchAs<SabpayRefund>(
            userId,
            `${BASE}/payments/${encodeURIComponent(paymentId)}/refunds`,
            {
                method: 'POST',
                body: JSON.stringify(body),
                headers: idemHeaders(idempotencyKey),
            },
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * Customers
     * ══════════════════════════════════════════════════════════════════════ */
    listCustomers: (q: SabpayCustomerListQuery = {}) =>
        rustFetch<SabpayCustomersList>(`${BASE}/customers${customerListQs(q)}`),
    createCustomer: (body: SabpayCreateCustomerBody, idempotencyKey?: string) =>
        rustFetch<SabpayCustomer>(`${BASE}/customers`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getCustomer: (id: string) =>
        rustFetch<SabpayCustomer>(`${BASE}/customers/${encodeURIComponent(id)}`),
    updateCustomer: (id: string, patch: SabpayUpdateCustomerBody) =>
        rustFetch<SabpayCustomer>(`${BASE}/customers/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    deleteCustomer: (id: string) =>
        rustFetch<{ success: boolean }>(`${BASE}/customers/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
    getCustomerPayments: (id: string) =>
        rustFetch<SabpayPaymentsArrayList>(
            `${BASE}/customers/${encodeURIComponent(id)}/payments`,
        ),

    listCustomersAs: (userId: string, q: SabpayCustomerListQuery = {}) =>
        rustFetchAs<SabpayCustomersList>(userId, `${BASE}/customers${customerListQs(q)}`),
    createCustomerAs: (userId: string, body: SabpayCreateCustomerBody, idempotencyKey?: string) =>
        rustFetchAs<SabpayCustomer>(userId, `${BASE}/customers`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getCustomerAs: (userId: string, id: string) =>
        rustFetchAs<SabpayCustomer>(userId, `${BASE}/customers/${encodeURIComponent(id)}`),
    updateCustomerAs: (userId: string, id: string, patch: SabpayUpdateCustomerBody) =>
        rustFetchAs<SabpayCustomer>(userId, `${BASE}/customers/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    deleteCustomerAs: (userId: string, id: string) =>
        rustFetchAs<{ success: boolean }>(
            userId,
            `${BASE}/customers/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
    getCustomerPaymentsAs: (userId: string, id: string) =>
        rustFetchAs<SabpayPaymentsArrayList>(
            userId,
            `${BASE}/customers/${encodeURIComponent(id)}/payments`,
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * Payment Links
     * ══════════════════════════════════════════════════════════════════════ */
    listPaymentLinks: (q: SabpayStatusListQuery = {}) =>
        rustFetch<SabpayPaymentLinksList>(`${BASE}/payment-links${statusListQs(q)}`),
    createPaymentLink: (body: SabpayCreatePaymentLinkBody, idempotencyKey?: string) =>
        rustFetch<SabpayPaymentLink>(`${BASE}/payment-links`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getPaymentLink: (id: string) =>
        rustFetch<SabpayPaymentLink>(`${BASE}/payment-links/${encodeURIComponent(id)}`),
    updatePaymentLink: (id: string, patch: SabpayUpdatePaymentLinkBody) =>
        rustFetch<SabpayPaymentLink>(`${BASE}/payment-links/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    cancelPaymentLink: (id: string) =>
        rustFetch<SabpayPaymentLink>(
            `${BASE}/payment-links/${encodeURIComponent(id)}/cancel`,
            { method: 'POST' },
        ),

    listPaymentLinksAs: (userId: string, q: SabpayStatusListQuery = {}) =>
        rustFetchAs<SabpayPaymentLinksList>(userId, `${BASE}/payment-links${statusListQs(q)}`),
    createPaymentLinkAs: (userId: string, body: SabpayCreatePaymentLinkBody, idempotencyKey?: string) =>
        rustFetchAs<SabpayPaymentLink>(userId, `${BASE}/payment-links`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getPaymentLinkAs: (userId: string, id: string) =>
        rustFetchAs<SabpayPaymentLink>(userId, `${BASE}/payment-links/${encodeURIComponent(id)}`),
    updatePaymentLinkAs: (userId: string, id: string, patch: SabpayUpdatePaymentLinkBody) =>
        rustFetchAs<SabpayPaymentLink>(
            userId,
            `${BASE}/payment-links/${encodeURIComponent(id)}`,
            { method: 'PATCH', body: JSON.stringify(patch) },
        ),
    cancelPaymentLinkAs: (userId: string, id: string) =>
        rustFetchAs<SabpayPaymentLink>(
            userId,
            `${BASE}/payment-links/${encodeURIComponent(id)}/cancel`,
            { method: 'POST' },
        ),

    getPublicLink: (id: string) =>
        rustFetchPublic<SabpayPublicLinkView>(
            `${BASE}/public/links/${encodeURIComponent(id)}`,
        ),
    createLinkSession: (id: string) =>
        rustFetchPublic<SabpaySessionResult>(
            `${BASE}/public/links/${encodeURIComponent(id)}/session`,
            { method: 'POST' },
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * Payment Pages
     * ══════════════════════════════════════════════════════════════════════ */
    listPaymentPages: (q: SabpayListQuery = {}) =>
        rustFetch<SabpayPaymentPagesList>(`${BASE}/payment-pages${listQs(q)}`),
    createPaymentPage: (body: SabpayCreatePaymentPageBody, idempotencyKey?: string) =>
        rustFetch<SabpayPaymentPage>(`${BASE}/payment-pages`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    checkPageSlug: (slug: string) =>
        rustFetch<SabpaySlugAvailable>(
            `${BASE}/payment-pages/slug-available?slug=${encodeURIComponent(slug)}`,
        ),
    getPaymentPage: (id: string) =>
        rustFetch<SabpayPaymentPage>(`${BASE}/payment-pages/${encodeURIComponent(id)}`),
    updatePaymentPage: (id: string, patch: SabpayUpdatePaymentPageBody) =>
        rustFetch<SabpayPaymentPage>(`${BASE}/payment-pages/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    deletePaymentPage: (id: string) =>
        rustFetch<{ success: boolean }>(`${BASE}/payment-pages/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),

    listPaymentPagesAs: (userId: string, q: SabpayListQuery = {}) =>
        rustFetchAs<SabpayPaymentPagesList>(userId, `${BASE}/payment-pages${listQs(q)}`),
    createPaymentPageAs: (userId: string, body: SabpayCreatePaymentPageBody, idempotencyKey?: string) =>
        rustFetchAs<SabpayPaymentPage>(userId, `${BASE}/payment-pages`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    checkPageSlugAs: (userId: string, slug: string) =>
        rustFetchAs<SabpaySlugAvailable>(
            userId,
            `${BASE}/payment-pages/slug-available?slug=${encodeURIComponent(slug)}`,
        ),
    getPaymentPageAs: (userId: string, id: string) =>
        rustFetchAs<SabpayPaymentPage>(userId, `${BASE}/payment-pages/${encodeURIComponent(id)}`),
    updatePaymentPageAs: (userId: string, id: string, patch: SabpayUpdatePaymentPageBody) =>
        rustFetchAs<SabpayPaymentPage>(
            userId,
            `${BASE}/payment-pages/${encodeURIComponent(id)}`,
            { method: 'PATCH', body: JSON.stringify(patch) },
        ),
    deletePaymentPageAs: (userId: string, id: string) =>
        rustFetchAs<{ success: boolean }>(
            userId,
            `${BASE}/payment-pages/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),

    getPublicPage: (slug: string) =>
        rustFetchPublic<SabpayPublicPageView>(
            `${BASE}/public/pages/${encodeURIComponent(slug)}`,
        ),
    createPageSession: (slug: string, body: SabpayPageSessionBody = {}) =>
        rustFetchPublic<SabpaySessionResult>(
            `${BASE}/public/pages/${encodeURIComponent(slug)}/session`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * Plans
     * ══════════════════════════════════════════════════════════════════════ */
    listPlans: (q: SabpayListQuery = {}) =>
        rustFetch<SabpayPlansList>(`${BASE}/plans${listQs(q)}`),
    createPlan: (body: SabpayCreatePlanBody, idempotencyKey?: string) =>
        rustFetch<SabpayPlan>(`${BASE}/plans`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getPlan: (id: string) =>
        rustFetch<SabpayPlan>(`${BASE}/plans/${encodeURIComponent(id)}`),
    deletePlan: (id: string) =>
        rustFetch<{ success: boolean }>(`${BASE}/plans/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),

    listPlansAs: (userId: string, q: SabpayListQuery = {}) =>
        rustFetchAs<SabpayPlansList>(userId, `${BASE}/plans${listQs(q)}`),
    createPlanAs: (userId: string, body: SabpayCreatePlanBody, idempotencyKey?: string) =>
        rustFetchAs<SabpayPlan>(userId, `${BASE}/plans`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getPlanAs: (userId: string, id: string) =>
        rustFetchAs<SabpayPlan>(userId, `${BASE}/plans/${encodeURIComponent(id)}`),
    deletePlanAs: (userId: string, id: string) =>
        rustFetchAs<{ success: boolean }>(
            userId,
            `${BASE}/plans/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * Subscriptions
     * ══════════════════════════════════════════════════════════════════════ */
    listSubscriptions: (q: SabpayStatusListQuery = {}) =>
        rustFetch<SabpaySubscriptionsList>(`${BASE}/subscriptions${statusListQs(q)}`),
    createSubscription: (body: SabpayCreateSubscriptionBody, idempotencyKey?: string) =>
        rustFetch<SabpaySubscription>(`${BASE}/subscriptions`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getSubscription: (id: string) =>
        rustFetch<SabpaySubscription>(`${BASE}/subscriptions/${encodeURIComponent(id)}`),
    updateSubscription: (id: string, patch: SabpayUpdateSubscriptionBody) =>
        rustFetch<SabpaySubscription>(`${BASE}/subscriptions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    cancelSubscription: (id: string, atCycleEnd = false) =>
        rustFetch<SabpaySubscription>(
            `${BASE}/subscriptions/${encodeURIComponent(id)}/cancel${atCycleEnd ? '?at_cycle_end=1' : ''}`,
            { method: 'POST' },
        ),
    pauseSubscription: (id: string) =>
        rustFetch<SabpaySubscription>(
            `${BASE}/subscriptions/${encodeURIComponent(id)}/pause`,
            { method: 'POST' },
        ),
    resumeSubscription: (id: string) =>
        rustFetch<SabpaySubscription>(
            `${BASE}/subscriptions/${encodeURIComponent(id)}/resume`,
            { method: 'POST' },
        ),

    listSubscriptionsAs: (userId: string, q: SabpayStatusListQuery = {}) =>
        rustFetchAs<SabpaySubscriptionsList>(userId, `${BASE}/subscriptions${statusListQs(q)}`),
    createSubscriptionAs: (userId: string, body: SabpayCreateSubscriptionBody, idempotencyKey?: string) =>
        rustFetchAs<SabpaySubscription>(userId, `${BASE}/subscriptions`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getSubscriptionAs: (userId: string, id: string) =>
        rustFetchAs<SabpaySubscription>(userId, `${BASE}/subscriptions/${encodeURIComponent(id)}`),
    updateSubscriptionAs: (userId: string, id: string, patch: SabpayUpdateSubscriptionBody) =>
        rustFetchAs<SabpaySubscription>(
            userId,
            `${BASE}/subscriptions/${encodeURIComponent(id)}`,
            { method: 'PATCH', body: JSON.stringify(patch) },
        ),
    cancelSubscriptionAs: (userId: string, id: string, atCycleEnd = false) =>
        rustFetchAs<SabpaySubscription>(
            userId,
            `${BASE}/subscriptions/${encodeURIComponent(id)}/cancel${atCycleEnd ? '?at_cycle_end=1' : ''}`,
            { method: 'POST' },
        ),
    pauseSubscriptionAs: (userId: string, id: string) =>
        rustFetchAs<SabpaySubscription>(
            userId,
            `${BASE}/subscriptions/${encodeURIComponent(id)}/pause`,
            { method: 'POST' },
        ),
    resumeSubscriptionAs: (userId: string, id: string) =>
        rustFetchAs<SabpaySubscription>(
            userId,
            `${BASE}/subscriptions/${encodeURIComponent(id)}/resume`,
            { method: 'POST' },
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * Invoices
     * ══════════════════════════════════════════════════════════════════════ */
    listInvoices: (q: SabpayStatusListQuery = {}) =>
        rustFetch<SabpayInvoicesList>(`${BASE}/invoices${statusListQs(q)}`),
    createInvoice: (body: SabpayCreateInvoiceBody, idempotencyKey?: string) =>
        rustFetch<SabpayInvoice>(`${BASE}/invoices`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getInvoice: (id: string) =>
        rustFetch<SabpayInvoice>(`${BASE}/invoices/${encodeURIComponent(id)}`),
    updateInvoice: (id: string, patch: SabpayUpdateInvoiceBody) =>
        rustFetch<SabpayInvoice>(`${BASE}/invoices/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    deleteInvoice: (id: string) =>
        rustFetch<{ success: boolean }>(`${BASE}/invoices/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
    issueInvoice: (id: string) =>
        rustFetch<SabpayInvoice>(`${BASE}/invoices/${encodeURIComponent(id)}/issue`, {
            method: 'POST',
        }),
    cancelInvoice: (id: string) =>
        rustFetch<SabpayInvoice>(`${BASE}/invoices/${encodeURIComponent(id)}/cancel`, {
            method: 'POST',
        }),

    listInvoicesAs: (userId: string, q: SabpayStatusListQuery = {}) =>
        rustFetchAs<SabpayInvoicesList>(userId, `${BASE}/invoices${statusListQs(q)}`),
    createInvoiceAs: (userId: string, body: SabpayCreateInvoiceBody, idempotencyKey?: string) =>
        rustFetchAs<SabpayInvoice>(userId, `${BASE}/invoices`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getInvoiceAs: (userId: string, id: string) =>
        rustFetchAs<SabpayInvoice>(userId, `${BASE}/invoices/${encodeURIComponent(id)}`),
    updateInvoiceAs: (userId: string, id: string, patch: SabpayUpdateInvoiceBody) =>
        rustFetchAs<SabpayInvoice>(
            userId,
            `${BASE}/invoices/${encodeURIComponent(id)}`,
            { method: 'PATCH', body: JSON.stringify(patch) },
        ),
    deleteInvoiceAs: (userId: string, id: string) =>
        rustFetchAs<{ success: boolean }>(
            userId,
            `${BASE}/invoices/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
    issueInvoiceAs: (userId: string, id: string) =>
        rustFetchAs<SabpayInvoice>(
            userId,
            `${BASE}/invoices/${encodeURIComponent(id)}/issue`,
            { method: 'POST' },
        ),
    cancelInvoiceAs: (userId: string, id: string) =>
        rustFetchAs<SabpayInvoice>(
            userId,
            `${BASE}/invoices/${encodeURIComponent(id)}/cancel`,
            { method: 'POST' },
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * QR Codes
     * ══════════════════════════════════════════════════════════════════════ */
    listQrCodes: (q: SabpayStatusListQuery = {}) =>
        rustFetch<SabpayQrCodesList>(`${BASE}/qr-codes${statusListQs(q)}`),
    createQrCode: (body: SabpayCreateQrCodeBody, idempotencyKey?: string) =>
        rustFetch<SabpayQrCode>(`${BASE}/qr-codes`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getQrCode: (id: string) =>
        rustFetch<SabpayQrCode>(`${BASE}/qr-codes/${encodeURIComponent(id)}`),
    closeQrCode: (id: string) =>
        rustFetch<SabpayQrCode>(`${BASE}/qr-codes/${encodeURIComponent(id)}/close`, {
            method: 'POST',
        }),

    listQrCodesAs: (userId: string, q: SabpayStatusListQuery = {}) =>
        rustFetchAs<SabpayQrCodesList>(userId, `${BASE}/qr-codes${statusListQs(q)}`),
    createQrCodeAs: (userId: string, body: SabpayCreateQrCodeBody, idempotencyKey?: string) =>
        rustFetchAs<SabpayQrCode>(userId, `${BASE}/qr-codes`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: idemHeaders(idempotencyKey),
        }),
    getQrCodeAs: (userId: string, id: string) =>
        rustFetchAs<SabpayQrCode>(userId, `${BASE}/qr-codes/${encodeURIComponent(id)}`),
    closeQrCodeAs: (userId: string, id: string) =>
        rustFetchAs<SabpayQrCode>(
            userId,
            `${BASE}/qr-codes/${encodeURIComponent(id)}/close`,
            { method: 'POST' },
        ),

    getPublicQr: (id: string) =>
        rustFetchPublic<SabpayPublicQrView>(`${BASE}/public/qr/${encodeURIComponent(id)}`),
    createQrSession: (id: string, body: SabpayQrSessionBody = {}) =>
        rustFetchPublic<SabpaySessionResult>(
            `${BASE}/public/qr/${encodeURIComponent(id)}/session`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * Settlements (read-only, live mode)
     * ══════════════════════════════════════════════════════════════════════ */
    listSettlements: (q: SabpayListQuery = {}) =>
        rustFetch<SabpaySettlementsList>(`${BASE}/settlements${listQs(q)}`),
    getSettlementSummary: () =>
        rustFetch<SabpaySettlementSummary>(`${BASE}/settlements/summary`),
    getSettlement: (id: string) =>
        rustFetch<SabpaySettlementDetail>(`${BASE}/settlements/${encodeURIComponent(id)}`),

    listSettlementsAs: (userId: string, q: SabpayListQuery = {}) =>
        rustFetchAs<SabpaySettlementsList>(userId, `${BASE}/settlements${listQs(q)}`),
    getSettlementSummaryAs: (userId: string) =>
        rustFetchAs<SabpaySettlementSummary>(userId, `${BASE}/settlements/summary`),
    getSettlementAs: (userId: string, id: string) =>
        rustFetchAs<SabpaySettlementDetail>(userId, `${BASE}/settlements/${encodeURIComponent(id)}`),

    /* ════════════════════════════════════════════════════════════════════════
     * Disputes
     * ══════════════════════════════════════════════════════════════════════ */
    listDisputes: (q: SabpayStatusListQuery = {}) =>
        rustFetch<SabpayDisputesList>(`${BASE}/disputes${statusListQs(q)}`),
    getDispute: (id: string) =>
        rustFetch<SabpayDispute>(`${BASE}/disputes/${encodeURIComponent(id)}`),
    acceptDispute: (id: string) =>
        rustFetch<SabpayDispute>(`${BASE}/disputes/${encodeURIComponent(id)}/accept`, {
            method: 'POST',
        }),
    contestDispute: (id: string, body: SabpayContestDisputeBody) =>
        rustFetch<SabpayDispute>(`${BASE}/disputes/${encodeURIComponent(id)}/contest`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    createTestDispute: (body: SabpayCreateTestDisputeBody) =>
        rustFetch<SabpayDispute>(`${BASE}/test/disputes`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listDisputesAs: (userId: string, q: SabpayStatusListQuery = {}) =>
        rustFetchAs<SabpayDisputesList>(userId, `${BASE}/disputes${statusListQs(q)}`),
    getDisputeAs: (userId: string, id: string) =>
        rustFetchAs<SabpayDispute>(userId, `${BASE}/disputes/${encodeURIComponent(id)}`),
    acceptDisputeAs: (userId: string, id: string) =>
        rustFetchAs<SabpayDispute>(
            userId,
            `${BASE}/disputes/${encodeURIComponent(id)}/accept`,
            { method: 'POST' },
        ),
    contestDisputeAs: (userId: string, id: string, body: SabpayContestDisputeBody) =>
        rustFetchAs<SabpayDispute>(
            userId,
            `${BASE}/disputes/${encodeURIComponent(id)}/contest`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
    createTestDisputeAs: (userId: string, body: SabpayCreateTestDisputeBody) =>
        rustFetchAs<SabpayDispute>(userId, `${BASE}/test/disputes`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /* ════════════════════════════════════════════════════════════════════════
     * Webhook deliveries
     * ══════════════════════════════════════════════════════════════════════ */
    listWebhookDeliveries: (query: SabpayWebhookDeliveryQuery = {}) =>
        rustFetch<SabpayWebhookDelivery[]>(
            `${BASE}/webhooks/deliveries${deliveryQs(query)}`,
        ),
    redeliverWebhook: (id: string) =>
        rustFetch<SabpayWebhookDelivery>(
            `${BASE}/webhooks/deliveries/${encodeURIComponent(id)}/redeliver`,
            { method: 'POST' },
        ),

    /* ════════════════════════════════════════════════════════════════════════
     * CSV exports — returns the raw CSV text (text/csv)
     * ══════════════════════════════════════════════════════════════════════ */
    exportCsv: (entity: SabpayExportEntity, query: SabpayExportQuery = {}) =>
        rustFetchText(`${BASE}/exports/${entity}${exportQs(query)}`),
};

export type SabpayApi = typeof sabpayApi;
