/**
 * PageSense raw heatmap events — append-only ingest + read.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/pagesense/heatmap-events';

export type HeatmapEventType = 'click' | 'move' | 'scroll';

export interface IngestEvent {
    url: string;
    eventType: HeatmapEventType;
    x: number;
    y: number;
    viewportW: number;
    viewportH: number;
    sessionId: string;
    variant?: string;
    /** epoch ms */
    ts?: number;
}

export interface HeatmapEventDoc {
    _id: string;
    userId: string;
    siteId: string;
    url: string;
    eventType: HeatmapEventType;
    x: number;
    y: number;
    viewportW: number;
    viewportH: number;
    sessionId: string;
    variant?: string;
    ts: string;
}

export const pagesenseHeatmapEventsApi = {
    ingest: (body: { siteId: string; events: IngestEvent[] }) =>
        rustFetch<{ accepted: number; rejected: number }>(`${BASE}/ingest`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    list: (params: {
        siteId: string;
        url?: string;
        eventType?: HeatmapEventType;
        limit?: number;
        fromMs?: number;
        toMs?: number;
    }) => {
        const sp = new URLSearchParams();
        sp.set('siteId', params.siteId);
        if (params.url) sp.set('url', params.url);
        if (params.eventType) sp.set('eventType', params.eventType);
        if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
        if (typeof params.fromMs === 'number') sp.set('fromMs', String(params.fromMs));
        if (typeof params.toMs === 'number') sp.set('toMs', String(params.toMs));
        return rustFetch<{ items: HeatmapEventDoc[] }>(`${BASE}?${sp.toString()}`);
    },
};

export type PagesenseHeatmapEventsApi = typeof pagesenseHeatmapEventsApi;
