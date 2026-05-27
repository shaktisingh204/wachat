import 'server-only';

import { rustFetch, rustPublicFetch } from './fetcher';

export type SabmonitorStatusPageIncidentKind =
    | 'investigating'
    | 'identified'
    | 'monitoring'
    | 'resolved';

export interface SabmonitorStatusPageIncidentDoc {
    _id?: string;
    userId: string;
    statusPageId: string;
    title: string;
    kind: SabmonitorStatusPageIncidentKind;
    postedAt: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
}

const BASE = '/v1/sabmonitor/status-page-incidents';
const PUBLIC_BASE = '/v1/sabmonitor/status-page-incidents-public';

export const sabmonitorStatusPageIncidentApi = {
    async list(params?: { statusPageId?: string; page?: number; limit?: number }) {
        const sp = new URLSearchParams();
        if (params?.statusPageId) sp.set('statusPageId', params.statusPageId);
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorStatusPageIncidentDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async create(input: {
        statusPageId: string;
        title: string;
        kind: SabmonitorStatusPageIncidentKind;
        body: string;
    }) {
        return rustFetch<{ id: string; entity: SabmonitorStatusPageIncidentDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(
        id: string,
        patch: {
            title?: string;
            kind?: SabmonitorStatusPageIncidentKind;
            body?: string;
        },
    ) {
        return rustFetch<SabmonitorStatusPageIncidentDoc>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async delete(id: string) {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
    async publicListByStatusPage(statusPageId: string) {
        return rustPublicFetch<{
            items: SabmonitorStatusPageIncidentDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${PUBLIC_BASE}/${statusPageId}`);
    },
};
