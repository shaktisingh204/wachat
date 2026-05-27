import 'server-only';

import { rustFetch } from './fetcher';

export type SabopsPatchSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SabopsPatchStatus =
    | 'available'
    | 'downloading'
    | 'installed'
    | 'failed'
    | 'pending_reboot';

export interface SabopsPatchDoc {
    _id?: string;
    userId: string;
    endpointId: string;
    name: string;
    kbId: string;
    severity: SabopsPatchSeverity;
    status: SabopsPatchStatus;
    releasedAt?: string;
    deployedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabopsPatchCreateInput {
    endpointId: string;
    name: string;
    kbId: string;
    severity: SabopsPatchSeverity;
    status?: SabopsPatchStatus;
    releasedAt?: string;
}

export interface SabopsPatchUpdateInput {
    status?: SabopsPatchStatus;
    severity?: SabopsPatchSeverity;
    deployedAt?: string;
}

export interface SabopsPatchListParams {
    q?: string;
    page?: number;
    limit?: number;
    endpointId?: string;
    severity?: SabopsPatchSeverity;
    status?: SabopsPatchStatus;
}

export interface SabopsPatchListResult {
    items: SabopsPatchDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

function qs(p: SabopsPatchListParams): string {
    const sp = new URLSearchParams();
    if (p.q) sp.set('q', p.q);
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.endpointId) sp.set('endpointId', p.endpointId);
    if (p.severity) sp.set('severity', p.severity);
    if (p.status) sp.set('status', p.status);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const patchesApi = {
    list(params: SabopsPatchListParams = {}): Promise<SabopsPatchListResult> {
        return rustFetch(`/v1/sabops/patches${qs(params)}`);
    },
    create(input: SabopsPatchCreateInput): Promise<{ id: string; entity: SabopsPatchDoc }> {
        return rustFetch(`/v1/sabops/patches`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    update(id: string, patch: SabopsPatchUpdateInput): Promise<SabopsPatchDoc> {
        return rustFetch(`/v1/sabops/patches/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch(`/v1/sabops/patches/${id}`, { method: 'DELETE' });
    },
};
