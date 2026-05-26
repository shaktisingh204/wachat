/**
 * PageSense session recordings (rrweb-format event blob lives in SabFiles).
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/pagesense/recordings';

export interface Recording {
    _id: string;
    userId: string;
    siteId: string;
    sessionId: string;
    startedAt: string;
    endedAt?: string;
    durationSecs: number;
    eventsFileId?: string;
    urlPath: string;
    userAgent?: string;
    country?: string;
    createdAt: string;
}

export const pagesenseRecordingsApi = {
    list: (params: {
        siteId: string;
        url?: string;
        country?: string;
        minDuration?: number;
        page?: number;
        limit?: number;
    }) => {
        const sp = new URLSearchParams();
        sp.set('siteId', params.siteId);
        if (params.url) sp.set('url', params.url);
        if (params.country) sp.set('country', params.country);
        if (typeof params.minDuration === 'number')
            sp.set('minDuration', String(params.minDuration));
        if (typeof params.page === 'number') sp.set('page', String(params.page));
        if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
        return rustFetch<{
            items: Recording[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}?${sp.toString()}`);
    },
    getById: (id: string) => rustFetch<Recording>(`${BASE}/${encodeURIComponent(id)}`),
    upsert: (body: {
        siteId: string;
        sessionId: string;
        startedAtMs: number;
        endedAtMs?: number;
        durationSecs: number;
        urlPath: string;
        userAgent?: string;
        country?: string;
        eventsFileId?: string;
    }) =>
        rustFetch<{ id: string }>(`${BASE}/upsert`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type PagesenseRecordingsApi = typeof pagesenseRecordingsApi;
