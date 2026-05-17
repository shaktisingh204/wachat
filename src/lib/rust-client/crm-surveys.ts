import 'server-only';

/**
 * CRM Survey client — wraps `/v1/crm/surveys`.
 */
import { rustFetch } from './fetcher';

export type CrmSurveyType =
    | 'engagement'
    | 'exit'
    | 'onboarding'
    | 'pulse'
    | 'custom';

export type CrmSurveyStatus = 'draft' | 'active' | 'closed' | 'archived';

export type CrmSurveyAudience = 'all' | 'department' | 'team' | 'role';

export type CrmSurveyQuestionType =
    | 'short_text'
    | 'long_text'
    | 'single_choice'
    | 'multiple_choice'
    | 'rating'
    | 'boolean';

export interface CrmSurveyQuestion {
    label: string;
    type: CrmSurveyQuestionType;
    required?: boolean;
    options?: string[];
}

export interface CrmSurveyDoc {
    _id: string;
    userId?: string;
    title: string;
    description?: string;
    type?: CrmSurveyType;
    questions?: CrmSurveyQuestion[];
    targetAudience?: CrmSurveyAudience;
    audienceIds?: string[];
    anonymous?: boolean;
    startsAt?: string;
    endsAt?: string;
    responseCount?: number;
    status?: CrmSurveyStatus;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmSurveyListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmSurveyStatus | 'all';
    type?: CrmSurveyType;
}

export interface CrmSurveyListResponse {
    items: CrmSurveyDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmSurveyCreateInput {
    title: string;
    description?: string;
    type?: CrmSurveyType;
    questions?: CrmSurveyQuestion[];
    targetAudience?: CrmSurveyAudience;
    audienceIds?: string[];
    anonymous?: boolean;
    startsAt?: string;
    endsAt?: string;
    status?: CrmSurveyStatus;
}

export type CrmSurveyUpdateInput = Partial<CrmSurveyCreateInput> & {
    responseCount?: number;
};

function buildListQuery(p?: CrmSurveyListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    if (p.type) qs.set('type', p.type);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmSurveysApi = {
    list: (params?: CrmSurveyListParams) =>
        rustFetch<CrmSurveyListResponse>(
            `/v1/crm/surveys${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmSurveyDoc>(
            `/v1/crm/surveys/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmSurveyCreateInput) =>
        rustFetch<{ id: string; entity: CrmSurveyDoc }>(
            '/v1/crm/surveys',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmSurveyUpdateInput) =>
        rustFetch<CrmSurveyDoc>(
            `/v1/crm/surveys/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/surveys/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
