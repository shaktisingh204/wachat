import 'server-only';

import { rustFetch } from './fetcher';

export interface SabmonitorTraceDoc {
    _id?: string;
    userId: string;
    traceId: string;
    rootService?: string;
    rootOperation?: string;
    startedAt?: string;
    durationMs: number;
    spanCount: number;
    errored: boolean;
    createdAt?: string;
    updatedAt?: string;
}

const BASE = '/v1/sabmonitor/traces';

export const sabmonitorTraceApi = {
    async list(params?: {
        page?: number;
        limit?: number;
        erroredOnly?: boolean;
        slowMs?: number;
        service?: string;
    }) {
        const sp = new URLSearchParams();
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        if (params?.erroredOnly) sp.set('erroredOnly', 'true');
        if (params?.slowMs !== undefined) sp.set('slowMs', String(params.slowMs));
        if (params?.service) sp.set('service', params.service);
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorTraceDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async getByTraceId(traceId: string) {
        try {
            return await rustFetch<SabmonitorTraceDoc>(`${BASE}/${traceId}`);
        } catch {
            return null;
        }
    },
};
