import 'server-only';

/**
 * CRM Feedback 360 client — wraps `/v1/crm/feedback-360`.
 */
import { rustFetch } from './fetcher';

export type Feedback360Status =
    | 'draft'
    | 'in_progress'
    | 'completed'
    | 'archived';

export type Feedback360ReviewerRole =
    | 'self'
    | 'manager'
    | 'peer'
    | 'direct_report'
    | 'other';

export interface Feedback360ReviewerResponse {
    reviewerId: string;
    role: Feedback360ReviewerRole;
    scores?: Record<string, number>;
    comments?: string;
    submittedAt?: string;
}

export interface Feedback360Doc {
    _id: string;
    userId?: string;
    employeeId: string;
    employeeName?: string;
    period?: string;
    reviewerIds: string[];
    reviewerResponses?: Feedback360ReviewerResponse[];
    aggregatedScores?: Record<string, number>;
    overallRating?: number;
    status?: Feedback360Status;
    completedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface Feedback360ListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: Feedback360Status | 'all';
    employeeId?: string;
    period?: string;
}

export interface Feedback360ListResponse {
    items: Feedback360Doc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface Feedback360CreateInput {
    employeeId: string;
    employeeName?: string;
    period?: string;
    reviewerIds?: string[];
    reviewerResponses?: Feedback360ReviewerResponse[];
    overallRating?: number;
    status?: Feedback360Status;
    completedAt?: string;
}

export type Feedback360UpdateInput = Partial<Feedback360CreateInput>;

function buildListQuery(p?: Feedback360ListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    if (p.employeeId) qs.set('employeeId', p.employeeId);
    if (p.period) qs.set('period', p.period);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmFeedback360Api = {
    list: (params?: Feedback360ListParams) =>
        rustFetch<Feedback360ListResponse>(
            `/v1/crm/feedback-360${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<Feedback360Doc>(
            `/v1/crm/feedback-360/${encodeURIComponent(id)}`,
        ),
    create: (input: Feedback360CreateInput) =>
        rustFetch<{ id: string; entity: Feedback360Doc }>(
            '/v1/crm/feedback-360',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: Feedback360UpdateInput) =>
        rustFetch<Feedback360Doc>(
            `/v1/crm/feedback-360/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/feedback-360/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
