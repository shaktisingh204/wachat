import 'server-only';

/**
 * CRM Certifications client — wraps `/v1/crm/certifications`.
 *
 * The Rust crate persists most field names in `snake_case` (matching the
 * legacy TS writer), so the interfaces below intentionally use `snake_case`
 * keys to match the JSON wire format produced by serde. Conversion to the
 * legacy camelCase DTO shape (`CrmCertificationDoc`) is done by the caller.
 */
import { rustFetch } from './fetcher';

export type CrmCertificationStatus =
    | 'active'
    | 'expired'
    | 'revoked'
    | 'archived';

export interface CrmCertificationDoc {
    _id: string;
    userId?: string;
    name: string;
    issuer?: string;
    employee_id?: string;
    employee_name?: string;
    certification_number?: string;
    issue_date?: string;
    expiry_date?: string;
    certificate_url?: string;
    status: CrmCertificationStatus;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmCertificationListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmCertificationStatus | 'all';
    employeeId?: string;
}

export interface CrmCertificationListResponse {
    items: CrmCertificationDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmCertificationCreateInput {
    name: string;
    issuer?: string;
    employee_id?: string;
    employee_name?: string;
    certification_number?: string;
    /** RFC3339 date-time string. */
    issue_date?: string;
    /** RFC3339 date-time string. */
    expiry_date?: string;
    certificate_url?: string;
    status?: CrmCertificationStatus;
}

export type CrmCertificationUpdateInput =
    Partial<CrmCertificationCreateInput>;

function buildListQuery(p?: CrmCertificationListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    if (p.employeeId) qs.set('employeeId', p.employeeId);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmCertificationsApi = {
    list: (params?: CrmCertificationListParams) =>
        rustFetch<CrmCertificationListResponse>(
            `/v1/crm/certifications${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmCertificationDoc>(
            `/v1/crm/certifications/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmCertificationCreateInput) =>
        rustFetch<{ id: string; entity: CrmCertificationDoc }>(
            '/v1/crm/certifications',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmCertificationUpdateInput) =>
        rustFetch<CrmCertificationDoc>(
            `/v1/crm/certifications/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/certifications/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
