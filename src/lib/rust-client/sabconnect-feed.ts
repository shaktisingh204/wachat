import 'server-only';

/**
 * SabConnect Feed client — wraps `/v1/sabconnect/feed`.
 *
 * Documents combine `posts`, plus pointers to entries spawned by other
 * workspace modules (announcements / recognitions / events). Field
 * naming mirrors the Rust DTO (`rename_all = "camelCase"`).
 */
import { rustFetch } from './fetcher';

export type SabConnectFeedKind = 'post' | 'announcement' | 'recognition' | 'event';
export type SabConnectFeedStatus = 'published' | 'archived';

export interface SabConnectFeedItemDoc {
    _id: string;
    userId?: string;
    authorId: string;
    authorName?: string;
    authorAvatarUrl?: string;
    kind: SabConnectFeedKind | string;
    body: string;
    attachmentIds?: string[];
    refId?: string;
    groupId?: string;
    pinnedUntil?: string;
    reactionCount?: number;
    commentCount?: number;
    tags?: string[];
    status: SabConnectFeedStatus | string;
    createdAt?: string;
    updatedAt?: string;
}

export interface SabConnectFeedListParams {
    page?: number;
    limit?: number;
    q?: string;
    kind?: SabConnectFeedKind | string;
    groupId?: string;
    authorId?: string;
    status?: SabConnectFeedStatus | 'all';
}

export interface SabConnectFeedListResponse {
    items: SabConnectFeedItemDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SabConnectFeedCreateInput {
    authorId: string;
    authorName?: string;
    authorAvatarUrl?: string;
    kind?: SabConnectFeedKind | string;
    body: string;
    attachmentIds?: string[];
    refId?: string;
    groupId?: string;
    pinnedUntil?: string;
    tags?: string[];
}

export type SabConnectFeedUpdateInput = Partial<
    Pick<
        SabConnectFeedItemDoc,
        | 'body'
        | 'attachmentIds'
        | 'pinnedUntil'
        | 'reactionCount'
        | 'commentCount'
        | 'status'
        | 'tags'
    >
>;

function buildListQuery(p?: SabConnectFeedListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.kind) qs.set('kind', p.kind);
    if (p.groupId) qs.set('groupId', p.groupId);
    if (p.authorId) qs.set('authorId', p.authorId);
    if (p.status) qs.set('status', p.status);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const sabconnectFeedApi = {
    list: (params?: SabConnectFeedListParams) =>
        rustFetch<SabConnectFeedListResponse>(`/v1/sabconnect/feed${buildListQuery(params)}`),
    getById: (id: string) =>
        rustFetch<SabConnectFeedItemDoc>(`/v1/sabconnect/feed/${encodeURIComponent(id)}`),
    create: (input: SabConnectFeedCreateInput) =>
        rustFetch<{ id: string; entity: SabConnectFeedItemDoc }>('/v1/sabconnect/feed', {
            method: 'POST',
            body: JSON.stringify(input),
        }),
    update: (id: string, patch: SabConnectFeedUpdateInput) =>
        rustFetch<SabConnectFeedItemDoc>(`/v1/sabconnect/feed/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(`/v1/sabconnect/feed/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};
