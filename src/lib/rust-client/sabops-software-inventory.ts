import 'server-only';

import { rustFetch } from './fetcher';

export type SabopsSoftwareSource = 'msi' | 'app_store' | 'brew' | 'apt';

export interface SabopsSoftwareDoc {
    _id?: string;
    userId: string;
    endpointId: string;
    name: string;
    version: string;
    vendor?: string;
    installedAt?: string;
    sizeBytes?: number;
    licenseKey?: string;
    source?: SabopsSoftwareSource;
    createdAt: string;
}

export interface SabopsSoftwareCreateInput {
    endpointId: string;
    name: string;
    version: string;
    vendor?: string;
    sizeBytes?: number;
    licenseKey?: string;
    source?: SabopsSoftwareSource;
    installedAt?: string;
}

export interface SabopsSoftwareListParams {
    q?: string;
    page?: number;
    limit?: number;
    endpointId?: string;
    source?: SabopsSoftwareSource;
}

export interface SabopsSoftwareListResult {
    items: SabopsSoftwareDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

function qs(p: SabopsSoftwareListParams): string {
    const sp = new URLSearchParams();
    if (p.q) sp.set('q', p.q);
    if (typeof p.page === 'number') sp.set('page', String(p.page));
    if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
    if (p.endpointId) sp.set('endpointId', p.endpointId);
    if (p.source) sp.set('source', p.source);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const softwareApi = {
    list(params: SabopsSoftwareListParams = {}): Promise<SabopsSoftwareListResult> {
        return rustFetch(`/v1/sabops/software${qs(params)}`);
    },
    create(input: SabopsSoftwareCreateInput): Promise<{ id: string; entity: SabopsSoftwareDoc }> {
        return rustFetch(`/v1/sabops/software`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch(`/v1/sabops/software/${id}`, { method: 'DELETE' });
    },
};
