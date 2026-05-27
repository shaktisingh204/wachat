import 'server-only';

import { rustFetch } from './fetcher';

export type SabopsMdmPlatform = 'ios' | 'android';
export type SabopsMdmProfileStatus = 'draft' | 'deployed';

export interface SabopsMdmProfileDoc {
    _id?: string;
    userId: string;
    name: string;
    platform: SabopsMdmPlatform;
    configJson: Record<string, unknown>;
    status: SabopsMdmProfileStatus;
    deployedToEndpointIds?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabopsMdmProfileCreateInput {
    name: string;
    platform: SabopsMdmPlatform;
    configJson: Record<string, unknown>;
}

export interface SabopsMdmProfileUpdateInput {
    name?: string;
    configJson?: Record<string, unknown>;
    status?: SabopsMdmProfileStatus;
}

export interface SabopsMdmProfileListParams {
    q?: string;
    page?: number;
    limit?: number;
    platform?: SabopsMdmPlatform;
    status?: SabopsMdmProfileStatus;
}

export interface SabopsMdmProfileListResult {
    items: SabopsMdmProfileDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

function qs(p: SabopsMdmProfileListParams): string {
    const sp = new URLSearchParams();
    if (p.q) sp.set('q', p.q);
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.platform) sp.set('platform', p.platform);
    if (p.status) sp.set('status', p.status);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const mdmProfilesApi = {
    list(params: SabopsMdmProfileListParams = {}): Promise<SabopsMdmProfileListResult> {
        return rustFetch(`/v1/sabops/mdm/profiles${qs(params)}`);
    },
    create(
        input: SabopsMdmProfileCreateInput,
    ): Promise<{ id: string; entity: SabopsMdmProfileDoc }> {
        return rustFetch(`/v1/sabops/mdm/profiles`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    update(id: string, patch: SabopsMdmProfileUpdateInput): Promise<SabopsMdmProfileDoc> {
        return rustFetch(`/v1/sabops/mdm/profiles/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch(`/v1/sabops/mdm/profiles/${id}`, { method: 'DELETE' });
    },
    deploy(
        id: string,
        endpointIds: string[],
    ): Promise<{ profileId: string; deployedCount: number }> {
        return rustFetch(`/v1/sabops/mdm/profiles/${id}/deploy`, {
            method: 'POST',
            body: JSON.stringify({ endpointIds }),
        });
    },
};
