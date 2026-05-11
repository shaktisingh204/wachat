/**
 * Typed client for the multi-tenant Telegram Payments BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/payments` by the
 * `telegram-payments` Rust crate (providers, templates, invoices,
 * payments, refunds, analytics, CSV).
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/payments';

// ---------------------------------------------------------------------------
//  Common envelopes
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    id?: string;
    invoiceLink?: string;
}

// ---------------------------------------------------------------------------
//  Providers
// ---------------------------------------------------------------------------

export interface ProviderRow {
    _id: string;
    projectId: string;
    botId: string;
    label: string;
    /** Masked representation (last 4 visible, rest as bullets). */
    providerTokenMasked: string;
    currency: string;
    testMode: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ListProvidersResp {
    providers: ProviderRow[];
    error?: string;
}

export interface CreateProviderBody {
    projectId: string;
    botId: string;
    label: string;
    providerToken: string;
    currency?: string;
    testMode?: boolean;
}

export interface UpdateProviderBody {
    projectId: string;
    label?: string;
    providerToken?: string;
    currency?: string;
    testMode?: boolean;
}

// ---------------------------------------------------------------------------
//  Templates
// ---------------------------------------------------------------------------

export interface PriceItem {
    label: string;
    amountCents: number;
}

export interface ShippingOptionConfig {
    id: string;
    title: string;
    prices: PriceItem[];
}

export interface TemplateRow {
    _id: string;
    projectId: string;
    name: string;
    title: string;
    description: string;
    payload: string;
    currency: string;
    prices: PriceItem[];
    photoUrl?: string;
    needName: boolean;
    needPhone: boolean;
    needEmail: boolean;
    needShipping: boolean;
    isFlexible: boolean;
    providerId?: string;
    shippingOptions?: ShippingOptionConfig[];
    createdAt: string;
    updatedAt: string;
}

export interface ListTemplatesResp {
    templates: TemplateRow[];
    error?: string;
}

export interface UpsertTemplateBody {
    projectId: string;
    name: string;
    title: string;
    description: string;
    payload: string;
    currency: string;
    prices: PriceItem[];
    photoUrl?: string;
    needName?: boolean;
    needPhone?: boolean;
    needEmail?: boolean;
    needShipping?: boolean;
    isFlexible?: boolean;
    providerId?: string;
    shippingOptions?: ShippingOptionConfig[];
}

// ---------------------------------------------------------------------------
//  Invoices (sent + links)
// ---------------------------------------------------------------------------

export interface InvoiceOverrides {
    title?: string;
    description?: string;
    payload?: string;
    currency?: string;
    prices?: PriceItem[];
}

export interface SendInvoiceBody {
    projectId: string;
    templateId: string;
    chatId: string;
    botId: string;
    overrides?: InvoiceOverrides;
}

export interface InvoiceLinkBody {
    projectId: string;
    templateId: string;
    botId?: string;
    overrides?: InvoiceOverrides;
}

export interface InvoiceRow {
    _id: string;
    projectId: string;
    botId: string;
    templateId?: string;
    chatId?: string;
    title: string;
    currency: string;
    amount: number;
    status: string;
    invoiceLink?: string;
    messageId?: number;
    paymentId?: string;
    createdAt: string;
}

export interface ListInvoicesResp {
    invoices: InvoiceRow[];
    error?: string;
}

// ---------------------------------------------------------------------------
//  Payments
// ---------------------------------------------------------------------------

export interface PaymentRow {
    _id: string;
    projectId: string;
    botId: string;
    invoiceId?: string;
    templateId?: string;
    chatId?: string;
    userId?: number;
    username?: string;
    currency: string;
    amount: number;
    status: string;
    telegramPaymentChargeId?: string;
    providerPaymentChargeId?: string;
    payload?: string;
    orderInfo?: unknown;
    shippingAddress?: unknown;
    createdAt: string;
    updatedAt: string;
}

export interface ListPaymentsQuery {
    projectId: string;
    from?: string;
    to?: string;
    status?: string;
    currency?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface ListPaymentsResp {
    payments: PaymentRow[];
    total: number;
    page: number;
    pageSize: number;
    error?: string;
}

export interface GetPaymentResp {
    payment?: PaymentRow;
    error?: string;
}

export interface RefundPaymentBody {
    projectId: string;
}

// ---------------------------------------------------------------------------
//  Analytics
// ---------------------------------------------------------------------------

export interface CurrencyTotal {
    currency: string;
    revenue: number;
    count: number;
}
export interface TemplateCount {
    templateId: string;
    title: string;
    count: number;
}
export interface DayPoint {
    date: string;
    revenue: number;
    count: number;
}
export interface AnalyticsResp {
    total: number;
    successful: number;
    pending: number;
    refunded: number;
    failed: number;
    by_currency: CurrencyTotal[];
    top_templates: TemplateCount[];
    by_day: DayPoint[];
    successRate: number;
    error?: string;
}

export interface AnalyticsQuery {
    projectId: string;
    from?: string;
    to?: string;
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
//  Public API surface
// ---------------------------------------------------------------------------

export const telegramPaymentsApi = {
    // Providers --------------------------------------------------------------
    listProviders: (projectId: string) =>
        rustFetch<ListProvidersResp>(`${BASE}/providers${qs({ projectId })}`),
    createProvider: (body: CreateProviderBody) =>
        rustFetch<AckResult>(`${BASE}/providers`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    updateProvider: (providerId: string, body: UpdateProviderBody) =>
        rustFetch<AckResult>(`${BASE}/providers/${encodeURIComponent(providerId)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteProvider: (providerId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/providers/${encodeURIComponent(providerId)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),
    testProvider: (providerId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/providers/${encodeURIComponent(providerId)}/test${qs({ projectId })}`,
            { method: 'POST' },
        ),

    // Templates --------------------------------------------------------------
    listTemplates: (projectId: string) =>
        rustFetch<ListTemplatesResp>(`${BASE}/templates${qs({ projectId })}`),
    createTemplate: (body: UpsertTemplateBody) =>
        rustFetch<AckResult>(`${BASE}/templates`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    updateTemplate: (templateId: string, body: UpsertTemplateBody) =>
        rustFetch<AckResult>(`${BASE}/templates/${encodeURIComponent(templateId)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteTemplate: (templateId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/templates/${encodeURIComponent(templateId)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),

    // Invoices (sent + link) -------------------------------------------------
    listInvoices: (projectId: string) =>
        rustFetch<ListInvoicesResp>(`${BASE}/invoices${qs({ projectId })}`),
    sendInvoice: (body: SendInvoiceBody) =>
        rustFetch<AckResult>(`${BASE}/invoices/send`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    createInvoiceLink: (body: InvoiceLinkBody) =>
        rustFetch<AckResult>(`${BASE}/invoices/link`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // Payments ---------------------------------------------------------------
    listPayments: (q: ListPaymentsQuery) =>
        rustFetch<ListPaymentsResp>(`${BASE}/${qs(q as Record<string, string | number | undefined>)}`),
    getPayment: (paymentId: string, projectId: string) =>
        rustFetch<GetPaymentResp>(
            `${BASE}/${encodeURIComponent(paymentId)}${qs({ projectId })}`,
        ),
    refundPayment: (paymentId: string, body: RefundPaymentBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(paymentId)}/refund`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    exportCsvUrl: (q: ListPaymentsQuery) =>
        `${BASE}/export${qs(q as Record<string, string | number | undefined>)}`,

    // Analytics --------------------------------------------------------------
    analytics: (q: AnalyticsQuery) =>
        rustFetch<AnalyticsResp>(`${BASE}/analytics${qs(q as Record<string, string | number | undefined>)}`),
};

export type TelegramPaymentsApi = typeof telegramPaymentsApi;
