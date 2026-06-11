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

import { rustFetch, rustFetchAs, rustFetchPublic } from './fetcher';
import type {
    SabpayApiKey,
    SabpayMerchant,
    SabpayMode,
    SabpayPayment,
    SabpayPaymentStatus,
    SabpayStats,
    SabpayWebhookDelivery,
    SabpayWebhookEndpoint,
    SabpayWebhookEvent,
} from '@/lib/sabpay/types';

const BASE = '/v1/sabpay';

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
};

export type SabpayApi = typeof sabpayApi;
