/**
 * SabShow Versions rust-client — wraps `/v1/sabshow/versions`.
 *
 * The actual deck-tree blob lives in SabFiles. This client only writes
 * the metadata row pointing at `snapshotFileId`.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabshowVersionDoc {
    _id?: string;
    deckId: string;
    version: number;
    savedAt: string;
    savedBy: string;
    comment?: string;
    snapshotFileId: string;
    thumbnailFileId?: string;
}

export interface SabshowVersionCreateInput {
    deckId: string;
    snapshotFileId: string;
    comment?: string;
    thumbnailFileId?: string;
}

const BASE = '/v1/sabshow/versions';

export const sabshowVersionsApi = {
    async listByDeck(deckId: string, limit = 50): Promise<SabshowVersionDoc[]> {
        const res = await rustFetch<{ items: SabshowVersionDoc[] }>(
            `${BASE}?deckId=${deckId}&limit=${limit}`
        );
        return res.items;
    },

    async create(input: SabshowVersionCreateInput): Promise<SabshowVersionDoc> {
        const res = await rustFetch<{ version: SabshowVersionDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return res.version;
    },

    async getById(id: string): Promise<SabshowVersionDoc | null> {
        const res = await rustFetch<{ version: SabshowVersionDoc }>(`${BASE}/${id}`);
        return res.version ?? null;
    },
};
