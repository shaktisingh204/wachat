import 'server-only';

import { rustFetch } from './fetcher';

export interface SabopsAdUserDoc {
    _id?: string;
    userId: string;
    domainId: string;
    samAccountName: string;
    upn: string;
    displayName: string;
    email?: string;
    groups: string[];
    enabled: boolean;
    lastSyncAt: string;
}

export interface SabopsAdUserUpsertInput {
    domainId: string;
    samAccountName: string;
    upn: string;
    displayName: string;
    email?: string;
    groups?: string[];
    enabled?: boolean;
}

export interface SabopsAdUserListParams {
    q?: string;
    page?: number;
    limit?: number;
    domainId?: string;
    enabled?: boolean;
}

export interface SabopsAdUserListResult {
    items: SabopsAdUserDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

function qs(p: SabopsAdUserListParams): string {
    const sp = new URLSearchParams();
    if (p.q) sp.set('q', p.q);
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.domainId) sp.set('domainId', p.domainId);
    if (typeof p.enabled === 'boolean') sp.set('enabled', String(p.enabled));
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const adUsersApi = {
    list(params: SabopsAdUserListParams = {}): Promise<SabopsAdUserListResult> {
        return rustFetch(`/v1/sabops/ad/users${qs(params)}`);
    },
    upsert(input: SabopsAdUserUpsertInput): Promise<{ id: string; entity: SabopsAdUserDoc }> {
        return rustFetch(`/v1/sabops/ad/users`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
};
