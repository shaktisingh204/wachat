import 'server-only';

/**
 * CRM Learning Paths client — wraps `/v1/crm/learning-paths`.
 *
 * The Rust crate persists `target_audience`, `duration_weeks`, `is_mandatory`
 * in `snake_case` to stay byte-compatible with the legacy Mongo rows. The
 * interfaces below mirror those wire names so JSON parses cleanly without
 * extra remapping.
 *
 * `trainings` is a flat `string[]` of `crm_trainings` _id refs (not nested
 * objects), per the Rust DTO.
 */
import { rustFetch } from './fetcher';

export type CrmLearningPathStatus = 'draft' | 'active' | 'archived';
export type CrmLearningPathAudience = 'all' | 'department' | 'role';

export interface CrmLearningPathDoc {
    _id: string;
    userId?: string;
    name: string;
    description?: string;
    target_audience: CrmLearningPathAudience | string;
    trainings: string[];
    duration_weeks?: number;
    is_mandatory: boolean;
    status: CrmLearningPathStatus;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmLearningPathListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmLearningPathStatus | 'all';
    targetAudience?: CrmLearningPathAudience;
}

export interface CrmLearningPathListResponse {
    items: CrmLearningPathDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface CrmLearningPathCreateInput {
    name: string;
    description?: string;
    target_audience?: CrmLearningPathAudience | string;
    trainings?: string[];
    duration_weeks?: number;
    is_mandatory?: boolean;
    status?: CrmLearningPathStatus;
}

export type CrmLearningPathUpdateInput = Partial<CrmLearningPathCreateInput>;

function buildListQuery(p?: CrmLearningPathListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    if (p.targetAudience) qs.set('targetAudience', p.targetAudience);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const crmLearningPathsApi = {
    list: (params?: CrmLearningPathListParams) =>
        rustFetch<CrmLearningPathListResponse>(
            `/v1/crm/learning-paths${buildListQuery(params)}`,
        ),
    getById: (id: string) =>
        rustFetch<CrmLearningPathDoc>(
            `/v1/crm/learning-paths/${encodeURIComponent(id)}`,
        ),
    create: (input: CrmLearningPathCreateInput) =>
        rustFetch<{ id: string; entity: CrmLearningPathDoc }>(
            '/v1/crm/learning-paths',
            {
                method: 'POST',
                body: JSON.stringify(input),
            },
        ),
    update: (id: string, patch: CrmLearningPathUpdateInput) =>
        rustFetch<CrmLearningPathDoc>(
            `/v1/crm/learning-paths/${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(patch),
            },
        ),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(
            `/v1/crm/learning-paths/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
        ),
};
