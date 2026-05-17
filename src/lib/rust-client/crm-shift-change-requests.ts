import 'server-only';

/**
 * CRM Shift Change Request client — wraps `/v1/crm/shift-change-requests`.
 *
 * NOTE: This entity uses `snake_case` BSON fields (no `rename_all` on the
 * Rust struct), so the TS shape mirrors that on the wire.
 */
import { rustFetch } from './fetcher';

export type CrmShiftChangeStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled';

export interface CrmShiftChangeRequestDoc {
    _id: string;
    userId?: string;
    employee_id: string;
    employee_name?: string;
    current_shift_id: string;
    current_shift_name?: string;
    requested_shift_id: string;
    requested_shift_name?: string;
    effective_date: string;
    reason?: string;
    status: CrmShiftChangeStatus;
    approver_id?: string;
    approved_at?: string;
    response_notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmShiftChangeRequestListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmShiftChangeStatus | 'all';
    employee_id?: string;
}

export interface CrmShiftChangeRequestListResponse {
    items: CrmShiftChangeRequestDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmShiftChangeRequestCreateInput {
    employee_id: string;
    employee_name?: string;
    current_shift_id: string;
    current_shift_name?: string;
    requested_shift_id: string;
    requested_shift_name?: string;
    effective_date: string;
    reason?: string;
    status?: CrmShiftChangeStatus;
}

export interface CrmShiftChangeRequestUpdateInput {
    employee_id?: string;
    employee_name?: string;
    current_shift_id?: string;
    current_shift_name?: string;
    requested_shift_id?: string;
    requested_shift_name?: string;
    effective_date?: string;
    reason?: string;
    status?: CrmShiftChangeStatus;
    approver_id?: string;
    response_notes?: string;
}

function buildListQuery(p?: CrmShiftChangeRequestListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    if (p.employee_id) qs.set('employee_id', p.employee_id);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmShiftChangeRequestsApi = {
    list: (params?: CrmShiftChangeRequestListParams) =>
        rustFetch<CrmShiftChangeRequestListResponse>(
            `/v1/crm/shift-change-requests${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmShiftChangeRequestDoc>(
            `/v1/crm/shift-change-requests/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmShiftChangeRequestCreateInput) =>
        rustFetch<{ id: string; entity: CrmShiftChangeRequestDoc }>(
            '/v1/crm/shift-change-requests',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (
        id: string,
        patch: CrmShiftChangeRequestUpdateInput,
    ) =>
        rustFetch<CrmShiftChangeRequestDoc>(
            `/v1/crm/shift-change-requests/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/shift-change-requests/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
