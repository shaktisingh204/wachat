import 'server-only';

/**
 * SabConnect Manuals client — wraps `/v1/sabconnect/manuals`.
 *
 * Manuals form a tree (via `parentId`) and may be scoped to a group.
 * `version` is bumped automatically when `body` is updated.
 */
import { rustFetch } from './fetcher';

export type SabConnectManualStatus = 'active' | 'archived';

export interface SabConnectManualDoc {
    _id: string;
    userId?: string;
    title: string;
    slug: string;
    body: string;
    groupId?: string;
    parentId?: string;
    published?: boolean;
    authorId?: string;
    authorName?: string;
    version?: number;
    tags?: string[];
    status: SabConnectManualStatus | string;
    createdAt?: string;
    updatedAt?: string;
}

export interface SabConnectManualListParams {
    page?: number;
    limit?: number;
    q?: string;
    groupId?: string;
    /** `'root'` to fetch only top-level pages, or a parent ObjectId. */
    parentId?: string;
    published?: boolean;
    status?: SabConnectManualStatus | 'all';
}

export interface SabConnectManualListResponse {
    items: SabConnectManualDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SabConnectManualCreateInput {
    title: string;
    slug?: string;
    body: string;
    groupId?: string;
    parentId?: string;
    published?: boolean;
    authorId?: string;
    authorName?: string;
    tags?: string[];
}

export type SabConnectManualUpdateInput = Partial<
    Pick<
        SabConnectManualDoc,
        'title' | 'slug' | 'body' | 'groupId' | 'parentId' | 'published' | 'status' | 'tags'
    >
>;

function buildListQuery(p?: SabConnectManualListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.groupId) qs.set('groupId', p.groupId);
    if (p.parentId) qs.set('parentId', p.parentId);
    if (p.published != null) qs.set('published', String(p.published));
    if (p.status) qs.set('status', p.status);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const sabconnectManualsApi = {
    list: (params?: SabConnectManualListParams) =>
        rustFetch<SabConnectManualListResponse>(`/v1/sabconnect/manuals${buildListQuery(params)}`),
    getById: (id: string) =>
        rustFetch<SabConnectManualDoc>(`/v1/sabconnect/manuals/${encodeURIComponent(id)}`),
    create: (input: SabConnectManualCreateInput) =>
        rustFetch<{ id: string; entity: SabConnectManualDoc }>('/v1/sabconnect/manuals', {
            method: 'POST',
            body: JSON.stringify(input),
        }),
    update: (id: string, patch: SabConnectManualUpdateInput) =>
        rustFetch<SabConnectManualDoc>(`/v1/sabconnect/manuals/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(`/v1/sabconnect/manuals/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};
