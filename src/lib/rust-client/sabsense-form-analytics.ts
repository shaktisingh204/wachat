/**
 * PageSense form analytics.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/pagesense/form-analytics';

export interface FieldDropoff {
    field: string;
    dropoffCount: number;
}

export interface FormAnalytics {
    _id: string;
    userId: string;
    siteId: string;
    formSelector: string;
    perFieldDropoff: FieldDropoff[];
    completionRate: number;
    createdAt: string;
    updatedAt?: string;
}

export const pagesenseFormAnalyticsApi = {
    list: (params: { siteId: string; page?: number; limit?: number }) => {
        const sp = new URLSearchParams();
        sp.set('siteId', params.siteId);
        if (typeof params.page === 'number') sp.set('page', String(params.page));
        if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
        return rustFetch<{
            items: FormAnalytics[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}?${sp.toString()}`);
    },
    upsert: (body: {
        siteId: string;
        formSelector: string;
        perFieldDropoff?: FieldDropoff[];
        completionRate?: number;
    }) =>
        rustFetch<{ id: string }>(`${BASE}/upsert`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};

export type PagesenseFormAnalyticsApi = typeof pagesenseFormAnalyticsApi;
