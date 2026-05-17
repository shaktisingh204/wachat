import 'server-only';

/**
 * CRM Travel Requests client — wraps `/v1/crm/travel`.
 *
 * The Rust crate (`crm_travel_requests` collection) persists every domain
 * field in `snake_case`, matching the legacy TS source-of-truth. The
 * interfaces below intentionally use `snake_case` so the JSON wire format
 * matches serde output without an extra remap step.
 */
import { rustFetch } from './fetcher';

export type CrmTravelStatus =
    | 'draft'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'completed'
    | 'archived';

export type CrmTravelMode =
    | 'flight'
    | 'train'
    | 'bus'
    | 'car'
    | 'taxi'
    | 'other';

export interface CrmTravelRequestDoc {
    _id: string;
    userId?: string;
    employee_id: string;
    employee_name?: string;
    purpose?: string;
    from_city?: string;
    to_city?: string;
    mode?: CrmTravelMode | string;
    travel_date?: string;
    return_date?: string | null;
    estimated_cost?: number;
    actual_cost?: number;
    currency?: string;
    status: CrmTravelStatus;
    approver_id?: string;
    approver_name?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmTravelListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmTravelStatus | 'all';
    employeeId?: string;
    approverId?: string;
}

export interface CrmTravelListResponse {
    items: CrmTravelRequestDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmTravelCreateInput {
    employee_id: string;
    employee_name?: string;
    purpose?: string;
    from_city?: string;
    to_city?: string;
    mode?: CrmTravelMode | string;
    /** RFC3339 date-time string. */
    travel_date?: string;
    /** RFC3339 date-time string. */
    return_date?: string;
    estimated_cost?: number;
    actual_cost?: number;
    currency?: string;
    status?: CrmTravelStatus;
    approver_id?: string;
    approver_name?: string;
    notes?: string;
}

export type CrmTravelUpdateInput = Partial<CrmTravelCreateInput>;

function buildListQuery(p?: CrmTravelListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    if (p.employeeId) qs.set('employeeId', p.employeeId);
    if (p.approverId) qs.set('approverId', p.approverId);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmTravelApi = {
    list: (params?: CrmTravelListParams) =>
        rustFetch<CrmTravelListResponse>(
            `/v1/crm/travel${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmTravelRequestDoc>(
            `/v1/crm/travel/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmTravelCreateInput) =>
        rustFetch<{ id: string; entity: CrmTravelRequestDoc }>(
            '/v1/crm/travel',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmTravelUpdateInput) =>
        rustFetch<CrmTravelRequestDoc>(
            `/v1/crm/travel/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/travel/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
