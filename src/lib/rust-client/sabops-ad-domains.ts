import 'server-only';

import { rustFetch } from './fetcher';

export type SabopsAdSyncDirection = 'pull_only' | 'two_way';
export type SabopsAdDomainStatus = 'connected' | 'error';

export interface SabopsAdDomainDoc {
    _id?: string;
    userId: string;
    name: string;
    controllerHost: string;
    status: SabopsAdDomainStatus;
    lastSyncAt?: string;
    syncDirection: SabopsAdSyncDirection;
    lastError?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabopsAdDomainCreateInput {
    name: string;
    controllerHost: string;
    syncDirection: SabopsAdSyncDirection;
}

export interface SabopsAdDomainUpdateInput {
    controllerHost?: string;
    syncDirection?: SabopsAdSyncDirection;
    status?: SabopsAdDomainStatus;
}

export const adDomainsApi = {
    list(q?: string): Promise<{ items: SabopsAdDomainDoc[] }> {
        const s = q ? `?q=${encodeURIComponent(q)}` : '';
        return rustFetch(`/v1/sabops/ad/domains${s}`);
    },
    create(input: SabopsAdDomainCreateInput): Promise<{ id: string; entity: SabopsAdDomainDoc }> {
        return rustFetch(`/v1/sabops/ad/domains`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    update(id: string, patch: SabopsAdDomainUpdateInput): Promise<SabopsAdDomainDoc> {
        return rustFetch(`/v1/sabops/ad/domains/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch(`/v1/sabops/ad/domains/${id}`, { method: 'DELETE' });
    },
    sync(id: string): Promise<{ domainId: string; status: string; lastSyncAt: string }> {
        return rustFetch(`/v1/sabops/ad/domains/${id}/sync`, { method: 'POST' });
    },
};
