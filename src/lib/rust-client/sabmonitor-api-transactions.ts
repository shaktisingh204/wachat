import 'server-only';

import { rustFetch } from './fetcher';

export interface SabmonitorApiTransactionDoc {
    _id?: string;
    userId: string;
    name: string;
    stepsJson: unknown;
    createdAt: string;
    updatedAt?: string;
}

const BASE = '/v1/sabmonitor/api-transactions';

export const sabmonitorApiTransactionApi = {
    async list(params?: { page?: number; limit?: number }) {
        const sp = new URLSearchParams();
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorApiTransactionDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async getById(id: string) {
        try {
            return await rustFetch<SabmonitorApiTransactionDoc>(`${BASE}/${id}`);
        } catch {
            return null;
        }
    },
    async create(input: { name: string; stepsJson: unknown }) {
        return rustFetch<{ id: string; entity: SabmonitorApiTransactionDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(id: string, patch: { name?: string; stepsJson?: unknown }) {
        return rustFetch<SabmonitorApiTransactionDoc>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async delete(id: string) {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
};
