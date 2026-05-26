/**
 * PageSense sites — registered domains with a snippet key.
 */
import 'server-only';

import { rustFetch, rustPublicFetch } from './fetcher';

const BASE = '/v1/pagesense/sites';

export interface PagesenseSite {
    _id: string;
    userId: string;
    name: string;
    domain: string;
    snippetKey: string;
    screenshotUrl?: string;
    isActive?: boolean;
    createdAt: string;
    updatedAt?: string;
    status?: string;
}

export interface CreateSiteInput {
    name: string;
    domain: string;
    screenshotUrl?: string;
    isActive?: boolean;
}

export interface UpdateSiteInput {
    name?: string;
    domain?: string;
    screenshotUrl?: string;
    isActive?: boolean;
    status?: string;
    rotateSnippetKey?: boolean;
}

export interface SnippetKeyLookup {
    siteId: string;
    userId: string;
    domain: string;
    isActive: boolean;
}

export const pagesenseSitesApi = {
    list: (params?: { q?: string; page?: number; limit?: number; status?: string }) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.set('q', params.q);
        if (typeof params?.page === 'number') sp.set('page', String(params.page));
        if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
        if (params?.status) sp.set('status', params.status);
        const qs = sp.toString();
        return rustFetch<{ items: PagesenseSite[]; page: number; limit: number; hasMore: boolean }>(
            `${BASE}${qs ? `?${qs}` : ''}`,
        );
    },
    getById: (id: string) => rustFetch<PagesenseSite>(`${BASE}/${encodeURIComponent(id)}`),
    create: (input: CreateSiteInput) =>
        rustFetch<{ id: string; entity: PagesenseSite }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        }),
    update: (id: string, patch: UpdateSiteInput) =>
        rustFetch<PagesenseSite>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),
    delete: (id: string) =>
        rustFetch<{ deleted: boolean }>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
    /**
     * Public lookup by snippet key — used by `/api/pagesense/ingest`
     * to validate before forwarding events. Uses the unauthenticated
     * fetcher because the snippet has no session.
     */
    lookupBySnippetKey: (snippetKey: string) =>
        rustPublicFetch<SnippetKeyLookup>(
            `${BASE}/by-snippet-key/${encodeURIComponent(snippetKey)}`,
        ),
};

export type PagesenseSitesApi = typeof pagesenseSitesApi;
