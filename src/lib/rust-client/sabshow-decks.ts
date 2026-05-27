/**
 * SabShow Decks rust-client — wraps `/v1/sabshow/decks` on the Rust BFF.
 *
 * Mirrors `rust/crates/sabshow-decks/src/types.rs` (`SabshowDeck`) and
 * `rust/crates/sabshow-decks/src/dto.rs`.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabshowDeckStatus = 'draft' | 'published' | 'archived';

export interface SabshowDeckDoc {
    _id?: string;
    ownerUserId: string;
    title: string;
    sharedWithUserIds?: string[];
    themeJson?: unknown;
    themeId?: string;
    status?: SabshowDeckStatus;
    defaultSlideId?: string;
    version?: number;
    coverFileId?: string;
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface SabshowDeckCreateInput {
    title: string;
    themeId?: string;
    themeJson?: unknown;
    tags?: string[];
}

export interface SabshowDeckUpdateInput {
    title?: string;
    themeId?: string;
    themeJson?: unknown;
    defaultSlideId?: string;
    coverFileId?: string;
    tags?: string[];
    status?: SabshowDeckStatus;
}

export interface SabshowDeckListResult {
    items: SabshowDeckDoc[];
    total: number;
    page: number;
    limit: number;
}

export interface SabshowDeckListParams {
    page?: number;
    limit?: number;
    q?: string;
    status?: SabshowDeckStatus | 'all';
    scope?: 'owned' | 'shared' | 'all';
}

const BASE = '/v1/sabshow/decks';

export const sabshowDecksApi = {
    async list(params: SabshowDeckListParams = {}): Promise<SabshowDeckListResult> {
        const qs = new URLSearchParams();
        if (params.page !== undefined) qs.set('page', String(params.page));
        if (params.limit !== undefined) qs.set('limit', String(params.limit));
        if (params.q) qs.set('q', params.q);
        if (params.status) qs.set('status', params.status);
        if (params.scope) qs.set('scope', params.scope);
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return rustFetch<SabshowDeckListResult>(`${BASE}${suffix}`);
    },

    async getById(id: string): Promise<SabshowDeckDoc | null> {
        const res = await rustFetch<{ deck: SabshowDeckDoc }>(`${BASE}/${id}`);
        return res.deck ?? null;
    },

    async create(input: SabshowDeckCreateInput): Promise<SabshowDeckDoc> {
        const res = await rustFetch<{ deck: SabshowDeckDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return res.deck;
    },

    async update(id: string, patch: SabshowDeckUpdateInput): Promise<SabshowDeckDoc> {
        const res = await rustFetch<{ deck: SabshowDeckDoc }>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
        return res.deck;
    },

    async delete(id: string): Promise<{ archived: boolean }> {
        return rustFetch<{ archived: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },

    async share(
        id: string,
        body: { addUserIds?: string[]; removeUserIds?: string[] }
    ): Promise<SabshowDeckDoc> {
        const res = await rustFetch<{ deck: SabshowDeckDoc }>(`${BASE}/${id}/share`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return res.deck;
    },
};
