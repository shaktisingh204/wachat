import 'server-only';

import { rustFetch } from './fetcher';

export interface SabmonitorSyntheticScriptDoc {
    _id?: string;
    userId: string;
    name: string;
    stepsJson: unknown;
    screenshotOnFailure: boolean;
    createdAt: string;
    updatedAt?: string;
}

const BASE = '/v1/sabmonitor/synthetic-scripts';

export const sabmonitorSyntheticScriptApi = {
    async list(params?: { page?: number; limit?: number }) {
        const sp = new URLSearchParams();
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorSyntheticScriptDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async getById(id: string) {
        try {
            return await rustFetch<SabmonitorSyntheticScriptDoc>(`${BASE}/${id}`);
        } catch {
            return null;
        }
    },
    async create(input: { name: string; stepsJson: unknown; screenshotOnFailure?: boolean }) {
        return rustFetch<{ id: string; entity: SabmonitorSyntheticScriptDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(
        id: string,
        patch: { name?: string; stepsJson?: unknown; screenshotOnFailure?: boolean },
    ) {
        return rustFetch<SabmonitorSyntheticScriptDoc>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async delete(id: string) {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
};
