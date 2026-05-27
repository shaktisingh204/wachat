import 'server-only';

import { rustFetch } from './fetcher';

export type SabopsAdGroupKind = 'security' | 'distribution';

export interface SabopsAdGroupMember {
    kind: 'user' | 'group';
    id: string;
}

export interface SabopsAdGroupDoc {
    _id?: string;
    userId: string;
    domainId: string;
    name: string;
    kind: SabopsAdGroupKind;
    members: SabopsAdGroupMember[];
    lastSyncAt: string;
}

export interface SabopsAdGroupUpsertInput {
    domainId: string;
    name: string;
    kind: SabopsAdGroupKind;
    members?: SabopsAdGroupMember[];
}

export interface SabopsAdGroupListParams {
    q?: string;
    page?: number;
    limit?: number;
    domainId?: string;
    kind?: SabopsAdGroupKind;
}

export interface SabopsAdGroupListResult {
    items: SabopsAdGroupDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

function qs(p: SabopsAdGroupListParams): string {
    const sp = new URLSearchParams();
    if (p.q) sp.set('q', p.q);
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.domainId) sp.set('domainId', p.domainId);
    if (p.kind) sp.set('kind', p.kind);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const adGroupsApi = {
    list(params: SabopsAdGroupListParams = {}): Promise<SabopsAdGroupListResult> {
        return rustFetch(`/v1/sabops/ad/groups${qs(params)}`);
    },
    upsert(input: SabopsAdGroupUpsertInput): Promise<{ id: string; entity: SabopsAdGroupDoc }> {
        return rustFetch(`/v1/sabops/ad/groups`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
};
