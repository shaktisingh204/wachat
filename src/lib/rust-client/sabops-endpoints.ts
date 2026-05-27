import 'server-only';

import { rustFetch } from './fetcher';

/* ─── Wire types — mirror sabops-endpoints types::SabopsEndpoint ─────── */

export type SabopsOs = 'windows' | 'macos' | 'linux' | 'ios' | 'android';
export type SabopsEndpointStatus = 'online' | 'offline' | 'stale' | 'disabled';

export interface SabopsEndpointDoc {
    _id?: string;
    userId: string;
    hostname: string;
    os: SabopsOs;
    osVersion?: string;
    agentVersion?: string;
    lastSeenAt?: string;
    status: SabopsEndpointStatus;
    ipAddress?: string;
    macAddress?: string;
    model?: string;
    serialNumber?: string;
    ownerUserId?: string;
    tags?: string[];
    healthScore?: number;
    createdAt: string;
    updatedAt?: string;
}

export interface SabopsEndpointCreateInput {
    hostname: string;
    os: SabopsOs;
    osVersion?: string;
    agentVersion?: string;
    ipAddress?: string;
    macAddress?: string;
    model?: string;
    serialNumber?: string;
    ownerUserId?: string;
    tags?: string[];
    status?: SabopsEndpointStatus;
    healthScore?: number;
}

export type SabopsEndpointUpdateInput = Partial<SabopsEndpointCreateInput>;

export interface SabopsEndpointListResult {
    items: SabopsEndpointDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface SabopsEndpointListParams {
    q?: string;
    page?: number;
    limit?: number;
    os?: SabopsOs;
    status?: SabopsEndpointStatus;
    tag?: string;
}

function qs(p: SabopsEndpointListParams): string {
    const sp = new URLSearchParams();
    if (p.q) sp.set('q', p.q);
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.os) sp.set('os', p.os);
    if (p.status) sp.set('status', p.status);
    if (p.tag) sp.set('tag', p.tag);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const endpointsApi = {
    list(params: SabopsEndpointListParams = {}): Promise<SabopsEndpointListResult> {
        return rustFetch<SabopsEndpointListResult>(`/v1/sabops/endpoints${qs(params)}`);
    },
    getById(id: string): Promise<SabopsEndpointDoc> {
        return rustFetch<SabopsEndpointDoc>(`/v1/sabops/endpoints/${id}`);
    },
    create(input: SabopsEndpointCreateInput): Promise<{ id: string; entity: SabopsEndpointDoc }> {
        return rustFetch(`/v1/sabops/endpoints`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    update(id: string, patch: SabopsEndpointUpdateInput): Promise<SabopsEndpointDoc> {
        return rustFetch<SabopsEndpointDoc>(`/v1/sabops/endpoints/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch(`/v1/sabops/endpoints/${id}`, { method: 'DELETE' });
    },
};
