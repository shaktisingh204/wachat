import 'server-only';

/**
 * SabConnect Custom Apps client — wraps `/v1/sabconnect/custom-apps`.
 *
 * Pinned tools for the SabConnect "Apps" grid. Icons come from SabFiles
 * (`iconFileId`); URLs are validated to be http(s).
 */
import { rustFetch } from './fetcher';

export type SabConnectCustomAppOpenIn = 'iframe' | 'new_tab';
export type SabConnectCustomAppStatus = 'active' | 'archived';

export interface SabConnectCustomAppDoc {
    _id: string;
    userId?: string;
    name: string;
    description?: string;
    iconFileId?: string;
    url: string;
    openIn?: SabConnectCustomAppOpenIn | string;
    sortOrder?: number;
    status: SabConnectCustomAppStatus | string;
    createdAt?: string;
    updatedAt?: string;
}

export interface SabConnectCustomAppListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: SabConnectCustomAppStatus | 'all';
}

export interface SabConnectCustomAppListResponse {
    items: SabConnectCustomAppDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SabConnectCustomAppCreateInput {
    name: string;
    url: string;
    description?: string;
    iconFileId?: string;
    openIn?: SabConnectCustomAppOpenIn;
    sortOrder?: number;
}

export type SabConnectCustomAppUpdateInput = Partial<
    Pick<
        SabConnectCustomAppDoc,
        'name' | 'url' | 'description' | 'iconFileId' | 'openIn' | 'sortOrder' | 'status'
    >
>;

function buildListQuery(p?: SabConnectCustomAppListParams): string {
    if (!p) return '';
    const qs = new URLSearchParams();
    if (p.page != null) qs.set('page', String(p.page));
    if (p.limit != null) qs.set('limit', String(p.limit));
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const sabconnectCustomAppsApi = {
    list: (params?: SabConnectCustomAppListParams) =>
        rustFetch<SabConnectCustomAppListResponse>(`/v1/sabconnect/custom-apps${buildListQuery(params)}`),
    getById: (id: string) =>
        rustFetch<SabConnectCustomAppDoc>(`/v1/sabconnect/custom-apps/${encodeURIComponent(id)}`),
    create: (input: SabConnectCustomAppCreateInput) =>
        rustFetch<{ id: string; entity: SabConnectCustomAppDoc }>('/v1/sabconnect/custom-apps', {
            method: 'POST',
            body: JSON.stringify(input),
        }),
    update: (id: string, patch: SabConnectCustomAppUpdateInput) =>
        rustFetch<SabConnectCustomAppDoc>(`/v1/sabconnect/custom-apps/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(`/v1/sabconnect/custom-apps/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};
