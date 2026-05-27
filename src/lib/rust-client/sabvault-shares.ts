import 'server-only';

/**
 * SabVault share-grant client — wraps `/v1/sabvault/shares`.
 *
 * Only the owner of a secret can create/revoke shares. The Rust handler
 * keeps the parent secret's `sharedWithUserIds` / `sharedWithTeamIds`
 * arrays in sync.
 */

import { rustFetch, RustApiError } from './fetcher';

export type SabvaultGranteeType = 'user' | 'team';
export type SabvaultSharePermission = 'read' | 'use' | 'edit';

export interface SabvaultShareDoc {
    _id?: string;
    userId: string;
    secretId: string;
    granteeType: SabvaultGranteeType;
    granteeId: string;
    permission: SabvaultSharePermission;
    grantedBy: string;
    grantedAt: string;
    expiresAt?: string;
    revokedAt?: string;
    revokedBy?: string;
    /** Opaque re-wrapped ciphertext for the grantee's key. */
    rewrappedPayloadB64?: string;
}

export interface SabvaultShareCreateInput {
    secretId: string;
    granteeType: SabvaultGranteeType;
    granteeId: string;
    permission?: SabvaultSharePermission;
    expiresAt?: string;
    rewrappedPayloadB64?: string;
}

export interface SabvaultShareUpdateInput {
    permission?: SabvaultSharePermission;
    expiresAt?: string;
    rewrappedPayloadB64?: string;
}

export interface SabvaultShareListParams {
    page?: number;
    limit?: number;
    secretId?: string;
    granteeId?: string;
    status?: 'active' | 'revoked' | 'all';
}

export interface SabvaultShareListResult {
    items: SabvaultShareDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

const BASE = '/v1/sabvault/shares';

function qs(p?: SabvaultShareListParams): string {
    const sp = new URLSearchParams();
    if (typeof p?.page === 'number') sp.set('page', String(Math.floor(p.page)));
    if (typeof p?.limit === 'number') sp.set('limit', String(Math.min(100, Math.floor(p.limit))));
    if (p?.secretId) sp.set('secretId', p.secretId);
    if (p?.granteeId) sp.set('granteeId', p.granteeId);
    if (p?.status) sp.set('status', p.status);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabvaultSharesApi = {
    async list(params?: SabvaultShareListParams): Promise<SabvaultShareListResult> {
        return await rustFetch(`${BASE}${qs(params)}`);
    },
    async create(input: SabvaultShareCreateInput) {
        return await rustFetch<{ id: string; entity: SabvaultShareDoc }>(`${BASE}`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    async update(id: string, patch: SabvaultShareUpdateInput): Promise<SabvaultShareDoc> {
        return await rustFetch(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },
    async revoke(id: string): Promise<{ revoked: boolean }> {
        try {
            return await rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return { revoked: false };
            throw e;
        }
    },
};
