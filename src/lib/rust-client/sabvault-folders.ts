import 'server-only';

/**
 * SabVault folder client — wraps `/v1/sabvault/folders`.
 */

import { rustFetch, RustApiError } from './fetcher';

export interface SabvaultFolderDoc {
    _id?: string;
    userId: string;
    name: string;
    parentId?: string;
    color?: string;
    icon?: string;
    createdAt: string;
    updatedAt?: string;
    status?: 'active' | 'archived' | string;
}

export interface SabvaultFolderCreateInput {
    name: string;
    parentId?: string;
    color?: string;
    icon?: string;
}

export type SabvaultFolderUpdateInput = Partial<SabvaultFolderCreateInput> & {
    status?: 'active' | 'archived';
};

export interface SabvaultFolderListParams {
    q?: string;
    page?: number;
    limit?: number;
    status?: 'active' | 'archived' | 'all';
    parentId?: string;
}

export interface SabvaultFolderListResult {
    items: SabvaultFolderDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

const BASE = '/v1/sabvault/folders';

function qs(p?: SabvaultFolderListParams): string {
    const sp = new URLSearchParams();
    if (p?.q?.trim()) sp.set('q', p.q.trim());
    if (typeof p?.page === 'number') sp.set('page', String(Math.floor(p.page)));
    if (typeof p?.limit === 'number') sp.set('limit', String(Math.min(100, Math.floor(p.limit))));
    if (p?.status) sp.set('status', p.status);
    if (p?.parentId) sp.set('parentId', p.parentId);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabvaultFoldersApi = {
    async list(params?: SabvaultFolderListParams): Promise<SabvaultFolderListResult> {
        return await rustFetch(`${BASE}${qs(params)}`);
    },
    async getById(id: string): Promise<SabvaultFolderDoc | null> {
        if (!id) return null;
        try {
            return await rustFetch<SabvaultFolderDoc>(`${BASE}/${encodeURIComponent(id)}`);
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },
    async create(input: SabvaultFolderCreateInput) {
        return await rustFetch<{ id: string; entity: SabvaultFolderDoc }>(`${BASE}`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(id: string, patch: SabvaultFolderUpdateInput): Promise<SabvaultFolderDoc> {
        return await rustFetch(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async delete(id: string): Promise<{ deleted: boolean }> {
        try {
            return await rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return { deleted: false };
            throw e;
        }
    },
};
