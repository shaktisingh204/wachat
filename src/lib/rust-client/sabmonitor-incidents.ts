import 'server-only';

import { rustFetch } from './fetcher';

export interface SabmonitorIncidentDoc {
    _id?: string;
    userId: string;
    checkId: string;
    startedAt: string;
    endedAt?: string;
    status: 'ongoing' | 'resolved';
    severity: 'critical' | 'major' | 'minor';
    downtimeSecs?: number;
    rootCauseSummary?: string;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

const BASE = '/v1/sabmonitor/incidents';

export const sabmonitorIncidentApi = {
    async list(params?: {
        page?: number;
        limit?: number;
        status?: 'ongoing' | 'resolved' | 'all';
        checkId?: string;
    }) {
        const sp = new URLSearchParams();
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        if (params?.status) sp.set('status', params.status);
        if (params?.checkId) sp.set('checkId', params.checkId);
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorIncidentDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async create(input: {
        checkId: string;
        severity: 'critical' | 'major' | 'minor';
        rootCauseSummary?: string;
    }) {
        return rustFetch<{ id: string; entity: SabmonitorIncidentDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async acknowledge(id: string) {
        return rustFetch<{ entity: SabmonitorIncidentDoc }>(
            `${BASE}/${id}/acknowledge`,
            { method: 'POST' },
        );
    },
    async resolve(id: string) {
        return rustFetch<{ entity: SabmonitorIncidentDoc }>(
            `${BASE}/${id}/resolve`,
            { method: 'POST' },
        );
    },
};
