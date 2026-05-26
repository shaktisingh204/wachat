/**
 * PageSense funnel definitions.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/pagesense/funnels';

export type StepMatchType = 'url' | 'event';

export interface FunnelStep {
    name: string;
    matchType: StepMatchType;
    pattern: string;
}

export interface Funnel {
    _id: string;
    userId: string;
    siteId: string;
    name: string;
    steps: FunnelStep[];
    createdAt: string;
    updatedAt?: string;
    status?: string;
}

export const pagesenseFunnelsApi = {
    list: (params: { siteId: string; page?: number; limit?: number; q?: string }) => {
        const sp = new URLSearchParams();
        sp.set('siteId', params.siteId);
        if (typeof params.page === 'number') sp.set('page', String(params.page));
        if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
        if (params.q) sp.set('q', params.q);
        return rustFetch<{
            items: Funnel[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}?${sp.toString()}`);
    },
    getById: (id: string) => rustFetch<Funnel>(`${BASE}/${encodeURIComponent(id)}`),
    create: (input: { siteId: string; name: string; steps: FunnelStep[] }) =>
        rustFetch<{ id: string; entity: Funnel }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        }),
    update: (id: string, patch: { name?: string; steps?: FunnelStep[]; status?: string }) =>
        rustFetch<Funnel>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};

export type PagesenseFunnelsApi = typeof pagesenseFunnelsApi;
