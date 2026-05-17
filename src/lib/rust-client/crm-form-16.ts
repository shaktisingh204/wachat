import 'server-only';

/**
 * CRM Form 16 client — wraps `/v1/crm/form-16`.
 */
import { rustFetch } from './fetcher';

export type CrmForm16Status = 'draft' | 'generated' | 'issued' | 'archived';

export interface CrmForm16Doc {
    _id: string;
    userId?: string;
    employeeId?: string;
    employeeName: string;
    financialYear: string;
    pan?: string;
    tanOfEmployer?: string;
    totalIncome?: number;
    taxDeducted?: number;
    documentUrl?: string;
    generatedAt?: string;
    generatedBy?: string;
    status?: CrmForm16Status;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmForm16ListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmForm16Status | 'all';
    financialYear?: string;
}

export interface CrmForm16ListResponse {
    items: CrmForm16Doc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmForm16CreateInput {
    employeeId?: string;
    employeeName: string;
    financialYear: string;
    pan?: string;
    tanOfEmployer?: string;
    totalIncome?: number;
    taxDeducted?: number;
    documentUrl?: string;
    status?: CrmForm16Status;
}

export type CrmForm16UpdateInput = Partial<CrmForm16CreateInput>;

function buildListQuery(p?: CrmForm16ListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    if (p.financialYear) qs.set('financialYear', p.financialYear);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmForm16Api = {
    list: (params?: CrmForm16ListParams) =>
        rustFetch<CrmForm16ListResponse>(
            `/v1/crm/form-16${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmForm16Doc>(
            `/v1/crm/form-16/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmForm16CreateInput) =>
        rustFetch<{ id: string; entity: CrmForm16Doc }>(
            '/v1/crm/form-16',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmForm16UpdateInput) =>
        rustFetch<CrmForm16Doc>(
            `/v1/crm/form-16/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/form-16/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
