/**
 * SabShow Slides rust-client — wraps `/v1/sabshow/slides` on the Rust BFF.
 *
 * Mirrors `rust/crates/sabshow-slides/src/types.rs`.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabshowSlideLayoutKind =
    | 'title'
    | 'content'
    | 'two_column'
    | 'image'
    | 'chart'
    | 'blank'
    | 'section_header';

export interface SabshowSlideDoc {
    _id?: string;
    deckId: string;
    userId: string;
    position: number;
    layoutKind?: SabshowSlideLayoutKind;
    backgroundJson?: unknown;
    notes?: string;
    title?: string;
    thumbnailFileId?: string;
    hidden?: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface SabshowSlideCreateInput {
    deckId: string;
    position?: number;
    layoutKind?: SabshowSlideLayoutKind;
    title?: string;
    backgroundJson?: unknown;
}

export interface SabshowSlideUpdateInput {
    layoutKind?: SabshowSlideLayoutKind;
    title?: string;
    backgroundJson?: unknown;
    notes?: string;
    thumbnailFileId?: string;
    hidden?: boolean;
}

const BASE = '/v1/sabshow/slides';

export const sabshowSlidesApi = {
    async listByDeck(deckId: string, includeHidden = false): Promise<SabshowSlideDoc[]> {
        const qs = new URLSearchParams({ deckId });
        if (includeHidden) qs.set('includeHidden', 'true');
        const res = await rustFetch<{ items: SabshowSlideDoc[] }>(
            `${BASE}?${qs.toString()}`
        );
        return res.items;
    },

    async getById(id: string): Promise<SabshowSlideDoc | null> {
        const res = await rustFetch<{ slide: SabshowSlideDoc }>(`${BASE}/${id}`);
        return res.slide ?? null;
    },

    async create(input: SabshowSlideCreateInput): Promise<SabshowSlideDoc> {
        const res = await rustFetch<{ slide: SabshowSlideDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return res.slide;
    },

    async update(id: string, patch: SabshowSlideUpdateInput): Promise<SabshowSlideDoc> {
        const res = await rustFetch<{ slide: SabshowSlideDoc }>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
        return res.slide;
    },

    async delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },

    async duplicate(id: string): Promise<SabshowSlideDoc> {
        const res = await rustFetch<{ slide: SabshowSlideDoc }>(
            `${BASE}/${id}/duplicate`,
            { method: 'POST' }
        );
        return res.slide;
    },

    async reorder(id: string, newPosition: number): Promise<SabshowSlideDoc> {
        const res = await rustFetch<{ slide: SabshowSlideDoc }>(
            `${BASE}/${id}/reorder`,
            { method: 'PATCH', body: JSON.stringify({ newPosition }) }
        );
        return res.slide;
    },
};
