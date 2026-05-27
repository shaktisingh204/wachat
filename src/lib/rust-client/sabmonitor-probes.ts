import 'server-only';

import { rustFetch } from './fetcher';

export interface SabmonitorProbeDoc {
    _id?: string;
    userId: string;
    region: string;
    label: string;
    status: 'online' | 'offline';
    lastSeenAt?: string;
    version?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabmonitorProbeCreateInput {
    region: string;
    label: string;
    version?: string;
}

export interface SabmonitorProbeUpdateInput {
    label?: string;
    status?: 'online' | 'offline';
    version?: string;
    heartbeat?: boolean;
}

const BASE = '/v1/sabmonitor/probes';

export const sabmonitorProbeApi = {
    async list(params?: { page?: number; limit?: number; region?: string }) {
        const sp = new URLSearchParams();
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        if (params?.region) sp.set('region', params.region);
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorProbeDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async getById(id: string) {
        try {
            return await rustFetch<SabmonitorProbeDoc>(`${BASE}/${id}`);
        } catch {
            return null;
        }
    },
    async create(input: SabmonitorProbeCreateInput) {
        return rustFetch<{ id: string; entity: SabmonitorProbeDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(id: string, patch: SabmonitorProbeUpdateInput) {
        return rustFetch<SabmonitorProbeDoc>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async delete(id: string) {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
};
