/**
 * PageSense funnel runs (computed snapshots).
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/pagesense/funnel-runs';

export interface StepResult {
    name: string;
    count: number;
    dropoffRate: number;
}

export interface FunnelRun {
    _id: string;
    userId: string;
    funnelId: string;
    siteId: string;
    periodFrom: string;
    periodTo: string;
    steps: StepResult[];
    totalSessions: number;
    createdAt: string;
}

export const pagesenseFunnelRunsApi = {
    list: (params: { funnelId: string; limit?: number }) => {
        const sp = new URLSearchParams();
        sp.set('funnelId', params.funnelId);
        if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
        return rustFetch<{ items: FunnelRun[] }>(`${BASE}?${sp.toString()}`);
    },
    run: (body: { funnelId: string; periodFromMs: number; periodToMs: number }) =>
        rustFetch<{ id: string; totalSessions: number }>(`${BASE}/run`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

export type PagesenseFunnelRunsApi = typeof pagesenseFunnelRunsApi;
