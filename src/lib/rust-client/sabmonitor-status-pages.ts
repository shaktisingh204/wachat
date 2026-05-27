import 'server-only';

import { rustFetch, rustPublicFetch } from './fetcher';

export interface SabmonitorStatusPageDoc {
    _id?: string;
    userId: string;
    slug: string;
    title: string;
    themeJson?: unknown;
    checkIds?: string[];
    showHistoricalUptime: boolean;
    customHeader?: string;
    customCss?: string;
    status: 'live' | 'paused';
    createdAt: string;
    updatedAt?: string;
}

export interface SabmonitorStatusPageCreateInput {
    slug: string;
    title: string;
    themeJson?: unknown;
    checkIds?: string[];
    showHistoricalUptime?: boolean;
    customHeader?: string;
    customCss?: string;
    status?: 'live' | 'paused';
}

export interface PublicCheckView {
    id: string;
    name: string;
    kind: string;
    lastStatus: string;
}

export interface PublicStatusPageView {
    slug: string;
    title: string;
    themeJson?: unknown;
    customHeader?: string;
    customCss?: string;
    showHistoricalUptime: boolean;
    checks: PublicCheckView[];
}

const BASE = '/v1/sabmonitor/status-pages';
const PUBLIC_BASE = '/v1/sabmonitor/status-pages-public';

export const sabmonitorStatusPageApi = {
    async list(params?: { page?: number; limit?: number }) {
        const sp = new URLSearchParams();
        if (params?.page !== undefined) sp.set('page', String(params.page));
        if (params?.limit !== undefined) sp.set('limit', String(params.limit));
        const q = sp.toString();
        return rustFetch<{
            items: SabmonitorStatusPageDoc[];
            page: number;
            limit: number;
            hasMore: boolean;
        }>(`${BASE}${q ? `?${q}` : ''}`);
    },
    async getById(id: string) {
        try {
            return await rustFetch<SabmonitorStatusPageDoc>(`${BASE}/${id}`);
        } catch {
            return null;
        }
    },
    async create(input: SabmonitorStatusPageCreateInput) {
        return rustFetch<{ id: string; entity: SabmonitorStatusPageDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(id: string, patch: Partial<SabmonitorStatusPageCreateInput>) {
        return rustFetch<SabmonitorStatusPageDoc>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async delete(id: string) {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
    /** Unauthenticated. Resolves a live page by slug. */
    async publicGetBySlug(slug: string) {
        return rustPublicFetch<PublicStatusPageView>(`${PUBLIC_BASE}/${slug}`);
    },
};
