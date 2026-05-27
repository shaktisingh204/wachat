/**
 * SabShow Publications rust-client — wraps `/v1/sabshow/publications`.
 *
 * `getPublicBySlug` is the only endpoint that does NOT require auth.
 */
import 'server-only';

import { rustFetch, rustFetchPublic } from './fetcher';

export type SabshowPublicationStatus = 'live' | 'paused';

export interface SabshowPublicationDoc {
    _id?: string;
    deckId: string;
    ownerUserId: string;
    slug: string;
    publishedVersion: number;
    themeJson?: unknown;
    status?: SabshowPublicationStatus;
    customCss?: string;
    coverFileId?: string;
    publishedAt: string;
    updatedAt?: string;
}

export interface SabshowPublishInput {
    deckId: string;
    slug: string;
    version?: number;
    themeJson?: unknown;
    customCss?: string;
    coverFileId?: string;
}

export interface SabshowPublicationUpdateInput {
    status?: SabshowPublicationStatus;
    publishedVersion?: number;
    themeJson?: unknown;
    customCss?: string;
    coverFileId?: string;
}

export interface SabshowPublicPublication {
    slug: string;
    deckId: string;
    publishedVersion: number;
    themeJson?: unknown;
    customCss?: string;
    coverFileId?: string;
}

const BASE = '/v1/sabshow/publications';

export const sabshowPublicationsApi = {
    async list(deckId?: string): Promise<SabshowPublicationDoc[]> {
        const qs = deckId ? `?deckId=${deckId}` : '';
        const res = await rustFetch<{ items: SabshowPublicationDoc[] }>(
            `${BASE}${qs}`
        );
        return res.items;
    },

    async publish(input: SabshowPublishInput): Promise<SabshowPublicationDoc> {
        const res = await rustFetch<{ publication: SabshowPublicationDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return res.publication;
    },

    async update(
        id: string,
        patch: SabshowPublicationUpdateInput
    ): Promise<SabshowPublicationDoc> {
        const res = await rustFetch<{ publication: SabshowPublicationDoc }>(
            `${BASE}/${id}`,
            { method: 'PATCH', body: JSON.stringify(patch) }
        );
        return res.publication;
    },

    async unpublish(id: string): Promise<{ deleted: boolean }> {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },

    /**
     * UNAUTHENTICATED — used by the public `/present/[slug]` page.
     */
    async getPublicBySlug(slug: string): Promise<SabshowPublicPublication | null> {
        try {
            return await rustFetchPublic<SabshowPublicPublication>(
                `${BASE}/public/${encodeURIComponent(slug)}`
            );
        } catch {
            return null;
        }
    },
};
