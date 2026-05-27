/**
 * SabShow Comments rust-client — wraps `/v1/sabshow/comments`.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabshowCommentDoc {
    _id?: string;
    deckId: string;
    slideId: string;
    elementId?: string;
    authorUserId: string;
    body: string;
    resolved?: boolean;
    parentCommentId?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabshowCommentCreateInput {
    deckId: string;
    slideId: string;
    body: string;
    elementId?: string;
    parentCommentId?: string;
}

export interface SabshowCommentUpdateInput {
    body?: string;
    resolved?: boolean;
}

const BASE = '/v1/sabshow/comments';

export const sabshowCommentsApi = {
    async listByDeck(
        deckId: string,
        opts: { slideId?: string; includeResolved?: boolean } = {}
    ): Promise<SabshowCommentDoc[]> {
        const qs = new URLSearchParams({ deckId });
        if (opts.slideId) qs.set('slideId', opts.slideId);
        if (opts.includeResolved) qs.set('includeResolved', 'true');
        const res = await rustFetch<{ items: SabshowCommentDoc[] }>(
            `${BASE}?${qs.toString()}`
        );
        return res.items;
    },

    async create(input: SabshowCommentCreateInput): Promise<SabshowCommentDoc> {
        const res = await rustFetch<{ comment: SabshowCommentDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return res.comment;
    },

    async update(
        id: string,
        patch: SabshowCommentUpdateInput
    ): Promise<SabshowCommentDoc> {
        const res = await rustFetch<{ comment: SabshowCommentDoc }>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
        return res.comment;
    },

    async delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
};
