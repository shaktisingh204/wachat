/**
 * PageSense aggregated heatmap snapshots.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/pagesense/heatmaps';

export interface HeatmapSnapshot {
    _id: string;
    userId: string;
    siteId: string;
    url: string;
    variant?: string;
    periodFrom: string;
    periodTo: string;
    clickGridJson: string;
    scrollDepthBuckets: number[];
    sampleSize: number;
    createdAt: string;
    updatedAt?: string;
}

export const pagesenseHeatmapsApi = {
    list: (params: {
        siteId: string;
        url?: string;
        variant?: string;
        page?: number;
        limit?: number;
    }) => {
        const sp = new URLSearchParams();
        sp.set('siteId', params.siteId);
        if (params.url) sp.set('url', params.url);
        if (params.variant) sp.set('variant', params.variant);
        if (typeof params.page === 'number') sp.set('page', String(params.page));
        if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
        return rustFetch<{
            items: HeatmapSnapshot[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}?${sp.toString()}`);
    },
    regenerate: (body: {
        siteId: string;
        url: string;
        variant?: string;
        periodFromMs: number;
        periodToMs: number;
    }) =>
        rustFetch<{ id: string; sampleSize: number }>(`${BASE}/regenerate`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type PagesenseHeatmapsApi = typeof pagesenseHeatmapsApi;
