import 'server-only';

import { rustFetch } from './fetcher';

export interface SabmonitorTraceSpanDoc {
    _id?: string;
    userId: string;
    traceId: string;
    parentSpanId?: string;
    spanId: string;
    service: string;
    operation: string;
    startedAt: string;
    durationMs: number;
    tagsJson?: unknown;
    errored: boolean;
}

export interface SabmonitorIngestSpanInput {
    traceId: string;
    parentSpanId?: string;
    spanId: string;
    service: string;
    operation: string;
    startedAtMs: number;
    durationMs: number;
    tagsJson?: unknown;
    errored?: boolean;
}

const BASE = '/v1/sabmonitor/trace-spans';

export const sabmonitorTraceSpanApi = {
    async list(params?: {
        traceId?: string;
        service?: string;
        page?: number;
        limit?: number;
    }) {
        const sp = new URLSearchParams();
        if (params?.traceId) sp.set('traceId', params.traceId);
        if (params?.service) sp.set('service', params.service);
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorTraceSpanDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async ingest(input: SabmonitorIngestSpanInput) {
        return rustFetch<{ id: string }>(`${BASE}/ingest`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
};
