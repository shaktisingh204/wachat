import 'server-only';

/**
 * SabConnect Comments client — wraps `/v1/sabconnect/comments`.
 *
 * Replies link to a parent comment via `parentCommentId`. Use
 * `parentCommentId: 'root'` to fetch only top-level comments.
 */
import { rustFetch } from './fetcher';

export type SabConnectCommentStatus = 'active' | 'deleted';

export interface SabConnectCommentDoc {
    _id: string;
    userId?: string;
    itemId: string;
    parentCommentId?: string;
    authorId: string;
    authorName?: string;
    authorAvatarUrl?: string;
    body: string;
    attachmentIds?: string[];
    edited?: boolean;
    status: SabConnectCommentStatus | string;
    createdAt?: string;
    updatedAt?: string;
}

export interface SabConnectCommentListParams {
    itemId: string;
    parentCommentId?: string;
    page?: number;
    limit?: number;
}

export interface SabConnectCommentListResponse {
    items: SabConnectCommentDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SabConnectCommentCreateInput {
    itemId: string;
    parentCommentId?: string;
    authorId: string;
    authorName?: string;
    authorAvatarUrl?: string;
    body: string;
    attachmentIds?: string[];
}

export interface SabConnectCommentUpdateInput {
    body?: string;
    attachmentIds?: string[];
}

function buildListQuery(p: SabConnectCommentListParams): string {
    const qs = new URLSearchParams();
    qs.set('itemId', p.itemId);
    if (p.parentCommentId) qs.set('parentCommentId', p.parentCommentId);
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    return `?${qs.toString()}`;
}

export const sabconnectCommentsApi = {
    list: (params: SabConnectCommentListParams) =>
        rustFetch<SabConnectCommentListResponse>(`/v1/sabconnect/comments${buildListQuery(params)}`),
    create: (input: SabConnectCommentCreateInput) =>
        rustFetch<{ id: string; entity: SabConnectCommentDoc }>('/v1/sabconnect/comments', {
            method: 'POST',
            body: JSON.stringify(input),
        }),
    update: (id: string, patch: SabConnectCommentUpdateInput) =>
        rustFetch<SabConnectCommentDoc>(`/v1/sabconnect/comments/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(`/v1/sabconnect/comments/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};
