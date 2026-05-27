import 'server-only';

import { rustFetch } from './fetcher';

export interface SabmonitorCheckRunDoc {
    _id?: string;
    userId: string;
    checkId: string;
    probeRegion: string;
    ts: string;
    status: 'up' | 'down' | 'warning';
    responseMs: number;
    httpStatusCode?: number;
    sslDaysToExpiry?: number;
    errorMessage?: string;
    traceJson?: string;
}

export interface SabmonitorReportRunInput {
    checkId: string;
    probeRegion: string;
    status: 'up' | 'down' | 'warning';
    responseMs: number;
    httpStatusCode?: number;
    sslDaysToExpiry?: number;
    errorMessage?: string;
    traceJson?: string;
}

const BASE = '/v1/sabmonitor/check-runs';

export const sabmonitorCheckRunApi = {
    async list(params?: {
        checkId?: string;
        status?: 'up' | 'down' | 'warning';
        region?: string;
        page?: number;
        limit?: number;
    }) {
        const sp = new URLSearchParams();
        if (params?.checkId) sp.set('checkId', params.checkId);
        if (params?.status) sp.set('status', params.status);
        if (params?.region) sp.set('region', params.region);
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorCheckRunDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async report(input: SabmonitorReportRunInput) {
        return rustFetch<{ id: string; entity: SabmonitorCheckRunDoc }>(
            `${BASE}/report`,
            { method: 'POST', body: JSON.stringify(input) },
        );
    },
};
