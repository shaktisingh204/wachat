import 'server-only';

/**
 * CRM Recurring Invoices client — wraps `/v1/crm/recurring-invoices`.
 *
 * Mirrors `rust/crates/crm-recurring-invoices/src/types.rs` +
 * `dto.rs`. Field names are camelCase to match the BSON `rename_all`
 * convention and the Mongo document on disk.
 */
import { rustFetch } from './fetcher';

export type CrmRecurringInvoiceStatus =
    | 'active'
    | 'paused'
    | 'stopped'
    | 'completed'
    | 'archived';

export type CrmRecurringInvoiceFrequency =
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'quarterly'
    | 'yearly';

export interface CrmRecurringInvoiceDoc {
    _id: string;
    userId?: string;
    title?: string;
    invoiceTemplateId?: string;
    customerId?: string;
    frequency: string;
    startDate?: string;
    endDate?: string;
    nextRunAt?: string;
    lastRunAt?: string;
    totalRuns?: number;
    status: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmRecurringInvoiceListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmRecurringInvoiceStatus | 'all';
}

export interface CrmRecurringInvoiceListResponse {
    items: CrmRecurringInvoiceDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmRecurringInvoiceCreateInput {
    title?: string;
    invoiceTemplateId?: string;
    customerId: string;
    frequency?: CrmRecurringInvoiceFrequency;
    /** ISO-8601 date/datetime. */
    startDate: string;
    /** ISO-8601 date/datetime. */
    endDate?: string;
    status?: CrmRecurringInvoiceStatus;
    notes?: string;
}

export type CrmRecurringInvoiceUpdateInput = Partial<
    Omit<CrmRecurringInvoiceCreateInput, 'customerId' | 'startDate'>
> & {
    customerId?: string;
    startDate?: string;
};

function buildListQuery(p?: CrmRecurringInvoiceListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmRecurringInvoicesApi = {
    list: (params?: CrmRecurringInvoiceListParams) =>
        rustFetch<CrmRecurringInvoiceListResponse>(
            `/v1/crm/recurring-invoices${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmRecurringInvoiceDoc>(
            `/v1/crm/recurring-invoices/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmRecurringInvoiceCreateInput) =>
        rustFetch<{ id: string; entity: CrmRecurringInvoiceDoc }>(
            '/v1/crm/recurring-invoices',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmRecurringInvoiceUpdateInput) =>
        rustFetch<CrmRecurringInvoiceDoc>(
            `/v1/crm/recurring-invoices/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/recurring-invoices/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
