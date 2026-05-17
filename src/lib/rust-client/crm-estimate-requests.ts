import 'server-only';

/**
 * CRM Estimate Requests client — wraps `/v1/crm/estimate-requests`.
 *
 * Mirrors `rust/crates/crm-estimate-requests/src/types.rs` + `dto.rs`.
 */
import { rustFetch } from './fetcher';

export type CrmEstimateRequestStatus =
    | 'pending'
    | 'in_review'
    | 'quoted'
    | 'declined'
    | 'archived';

export type CrmEstimateRequestSource =
    | 'web'
    | 'email'
    | 'phone'
    | 'referral'
    | 'other';

export interface CrmEstimateRequestDoc {
    _id: string;
    userId?: string;
    customerName: string;
    customerEmail?: string;
    requirements: string;
    budgetRange?: string;
    deadline?: string;
    source: string;
    status: string;
    assignedToId?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmEstimateRequestListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmEstimateRequestStatus | 'all';
}

export interface CrmEstimateRequestListResponse {
    items: CrmEstimateRequestDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmEstimateRequestCreateInput {
    customerName: string;
    customerEmail?: string;
    requirements: string;
    budgetRange?: string;
    /** ISO-8601 date/datetime. */
    deadline?: string;
    source?: CrmEstimateRequestSource;
    status?: CrmEstimateRequestStatus;
    assignedToId?: string;
    notes?: string;
}

export type CrmEstimateRequestUpdateInput = Partial<CrmEstimateRequestCreateInput>;

function buildListQuery(p?: CrmEstimateRequestListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmEstimateRequestsApi = {
    list: (params?: CrmEstimateRequestListParams) =>
        rustFetch<CrmEstimateRequestListResponse>(
            `/v1/crm/estimate-requests${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmEstimateRequestDoc>(
            `/v1/crm/estimate-requests/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmEstimateRequestCreateInput) =>
        rustFetch<{ id: string; entity: CrmEstimateRequestDoc }>(
            '/v1/crm/estimate-requests',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmEstimateRequestUpdateInput) =>
        rustFetch<CrmEstimateRequestDoc>(
            `/v1/crm/estimate-requests/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/estimate-requests/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
