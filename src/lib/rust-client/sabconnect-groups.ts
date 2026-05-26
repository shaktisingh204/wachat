import 'server-only';

/**
 * SabConnect Groups client — wraps `/v1/sabconnect/groups`.
 *
 * Visibility: `open` (anyone can join), `closed` (request to join),
 * `secret` (invite only — hidden from directories).
 */
import { rustFetch } from './fetcher';

export type SabConnectGroupVisibility = 'open' | 'closed' | 'secret';
export type SabConnectGroupStatus = 'active' | 'archived';

export interface SabConnectGroupDoc {
    _id: string;
    userId?: string;
    name: string;
    description?: string;
    visibility: SabConnectGroupVisibility | string;
    coverFileId?: string;
    memberIds?: string[];
    ownerId?: string;
    adminIds?: string[];
    memberCount?: number;
    status: SabConnectGroupStatus | string;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface SabConnectGroupListParams {
    page?: number;
    limit?: number;
    q?: string;
    visibility?: SabConnectGroupVisibility;
    status?: SabConnectGroupStatus | 'all';
    memberId?: string;
}

export interface SabConnectGroupListResponse {
    items: SabConnectGroupDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SabConnectGroupCreateInput {
    name: string;
    description?: string;
    visibility?: SabConnectGroupVisibility;
    coverFileId?: string;
    ownerId?: string;
    adminIds?: string[];
    memberIds?: string[];
    tags?: string[];
}

export type SabConnectGroupUpdateInput = Partial<
    Pick<
        SabConnectGroupDoc,
        | 'name'
        | 'description'
        | 'visibility'
        | 'coverFileId'
        | 'ownerId'
        | 'adminIds'
        | 'status'
        | 'tags'
    >
>;

function buildListQuery(p?: SabConnectGroupListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.visibility) qs.set('visibility', p.visibility);
    if (p.status) qs.set('status', p.status);
    if (p.memberId) qs.set('memberId', p.memberId);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const sabconnectGroupsApi = {
    list: (params?: SabConnectGroupListParams) =>
        rustFetch<SabConnectGroupListResponse>(`/v1/sabconnect/groups${buildListQuery(params)}`),
    getById: (id: string) =>
        rustFetch<SabConnectGroupDoc>(`/v1/sabconnect/groups/${encodeURIComponent(id)}`),
    create: (input: SabConnectGroupCreateInput) =>
        rustFetch<{ id: string; entity: SabConnectGroupDoc }>('/v1/sabconnect/groups', {
            method: 'POST',
            body: JSON.stringify(input),
        }),
    update: (id: string, patch: SabConnectGroupUpdateInput) =>
        rustFetch<SabConnectGroupDoc>(`/v1/sabconnect/groups/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(`/v1/sabconnect/groups/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
    join: (id: string, memberId: string) =>
        rustFetch<SabConnectGroupDoc>(`/v1/sabconnect/groups/${encodeURIComponent(id)}/join`, {
            method: 'POST',
            body: JSON.stringify({ memberId }),
        }),
    leave: (id: string, memberId: string) =>
        rustFetch<SabConnectGroupDoc>(`/v1/sabconnect/groups/${encodeURIComponent(id)}/leave`, {
            method: 'POST',
            body: JSON.stringify({ memberId }),
        }),
};
