/**
 * SabShow Themes rust-client — wraps `/v1/sabshow/themes`.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabshowThemeDoc {
    _id?: string;
    userId?: string;
    name: string;
    configJson?: unknown;
    previewFileId?: string;
    builtIn?: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface SabshowThemeCreateInput {
    name: string;
    configJson?: unknown;
    previewFileId?: string;
}

export interface SabshowThemeUpdateInput {
    name?: string;
    configJson?: unknown;
    previewFileId?: string;
}

const BASE = '/v1/sabshow/themes';

export const sabshowThemesApi = {
    async list(includeBuiltIn = true): Promise<SabshowThemeDoc[]> {
        const res = await rustFetch<{ items: SabshowThemeDoc[] }>(
            `${BASE}?includeBuiltIn=${includeBuiltIn ? 'true' : 'false'}`
        );
        return res.items;
    },

    async getById(id: string): Promise<SabshowThemeDoc | null> {
        const res = await rustFetch<{ theme: SabshowThemeDoc }>(`${BASE}/${id}`);
        return res.theme ?? null;
    },

    async create(input: SabshowThemeCreateInput): Promise<SabshowThemeDoc> {
        const res = await rustFetch<{ theme: SabshowThemeDoc }>(BASE, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return res.theme;
    },

    async update(id: string, patch: SabshowThemeUpdateInput): Promise<SabshowThemeDoc> {
        const res = await rustFetch<{ theme: SabshowThemeDoc }>(`${BASE}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
        return res.theme;
    },

    async delete(id: string): Promise<{ deleted: boolean }> {
        return rustFetch<{ deleted: boolean }>(`${BASE}/${id}`, { method: 'DELETE' });
    },
};
