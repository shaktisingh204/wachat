/**
 * SabShow Elements rust-client — wraps `/v1/sabshow/elements`.
 *
 * Mirrors `rust/crates/sabshow-elements/src/types.rs`.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabshowElementKind =
    | 'text'
    | 'image'
    | 'shape'
    | 'chart'
    | 'video'
    | 'code';

export interface SabshowElementDoc {
    _id?: string;
    slideId: string;
    deckId: string;
    userId: string;
    kind: SabshowElementKind;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
    zIndex?: number;
    locked?: boolean;
    configJson?: unknown;
    createdAt: string;
    updatedAt?: string;
}

export interface SabshowElementCreateInput {
    slideId: string;
    kind: SabshowElementKind;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
    zIndex?: number;
    configJson?: unknown;
}

export interface SabshowElementUpdateInput {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rotation?: number;
    zIndex?: number;
    locked?: boolean;
    configJson?: unknown;
}

const BASE = '/v1/sabshow/elements';

export const sabshowElementsApi = {
    async listBySlide(slideId: string): Promise<SabshowElementDoc[]> {
        const res = await rustFetch<{ items: SabshowElementDoc[] }>(
            `${BASE}?slideId=${slideId}`
        );
        return res.items;
    },

    async listByDeck(deckId: string): Promise<SabshowElementDoc[]> {
        const res = await rustFetch<{ items: SabshowElementDoc[] }>(
            `${BASE}?deckId=${deckId}`
        );
        return res.items;
    },

    async getById(id: string): Promise<SabshowElementDoc | null> {
        const res = await rustFetch<{ element: SabshowElementDoc }>(`${BASE}/${id}`);
        return res.element ?? null;
    },

    async create(input: SabshowElementCreateInput): Promise<SabshowElementDoc> {
        const res = await rustFetch<{ element: SabshowElementDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return res.element;
    },

    async update(
        id: string,
        patch: SabshowElementUpdateInput
    ): Promise<SabshowElementDoc> {
        const res = await rustFetch<{ element: SabshowElementDoc }>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
        return res.element;
    },

    async delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
};
