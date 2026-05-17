import 'server-only';

/**
 * CRM Bank Transactions client — wraps `/v1/crm/bank-transactions`.
 *
 * Mirrors `rust/crates/crm-bank-transactions/src/types.rs` + `dto.rs`.
 * Note that on the Rust side the field is renamed to `type` (matching
 * the on-disk JSON), so the TS types use `type` as well.
 */
import { rustFetch } from './fetcher';

export type CrmBankTransactionType = 'debit' | 'credit';

export type CrmBankTransactionStatus =
    | 'pending'
    | 'cleared'
    | 'reconciled'
    | 'archived';

export interface CrmBankTransactionDoc {
    _id: string;
    userId?: string;
    accountId: string;
    transactionDate: string;
    amount: number;
    type: CrmBankTransactionType;
    description?: string;
    referenceNumber?: string;
    balanceAfter?: number;
    category?: string;
    voucherEntryId?: string;
    status: CrmBankTransactionStatus;
    sourceFileUrl?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmBankTransactionListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmBankTransactionStatus | 'all';
    accountId?: string;
    type?: CrmBankTransactionType;
    category?: string;
    /** ISO-8601 date. */
    from?: string;
    /** ISO-8601 date. */
    to?: string;
}

export interface CrmBankTransactionListResponse {
    items: CrmBankTransactionDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmBankTransactionCreateInput {
    accountId: string;
    /** ISO-8601 date string. */
    transactionDate: string;
    amount: number;
    type: CrmBankTransactionType;
    description?: string;
    referenceNumber?: string;
    balanceAfter?: number;
    category?: string;
    voucherEntryId?: string;
    status?: CrmBankTransactionStatus;
    sourceFileUrl?: string;
}

export type CrmBankTransactionUpdateInput = Partial<CrmBankTransactionCreateInput>;

function buildListQuery(p?: CrmBankTransactionListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    if (p.accountId) qs.set('accountId', p.accountId);
    if (p.type) qs.set('type', p.type);
    if (p.category) qs.set('category', p.category);
    if (p.from) qs.set('from', p.from);
    if (p.to) qs.set('to', p.to);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmBankTransactionsApi = {
    list: (params?: CrmBankTransactionListParams) =>
        rustFetch<CrmBankTransactionListResponse>(
            `/v1/crm/bank-transactions${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmBankTransactionDoc>(
            `/v1/crm/bank-transactions/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmBankTransactionCreateInput) =>
        rustFetch<{ id: string; entity: CrmBankTransactionDoc }>(
            '/v1/crm/bank-transactions',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmBankTransactionUpdateInput) =>
        rustFetch<CrmBankTransactionDoc>(
            `/v1/crm/bank-transactions/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/bank-transactions/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
