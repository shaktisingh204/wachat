import 'server-only';

/**
 * SabVault Secret client — wraps `/v1/sabvault/secrets` on the Rust BFF.
 *
 * Server stores opaque `encryptedPayloadB64`. PLAINTEXT NEVER LEAVES THE
 * CLIENT — every payload sent through this client is already AES-GCM
 * ciphertext produced by `src/lib/sabvault/crypto.ts`.
 *
 * Tightly typed against `sabvault_secrets::types::SabvaultSecret` and
 * `sabvault_secrets::dto::*` in `rust/crates/sabvault-secrets/`.
 */

import { rustFetch, RustApiError } from './fetcher';

/* ─── Wire types ─────────────────────────────────────────────────────── */

export type SabvaultSecretKind =
    | 'login'
    | 'note'
    | 'card'
    | 'identity'
    | 'key'
    | 'wifi'
    | 'server';

export interface SabvaultSecretDoc {
    _id?: string;
    userId: string;
    name: string;
    kind: SabvaultSecretKind;
    /** Opaque AES-GCM ciphertext envelope. Base64. */
    encryptedPayloadB64: string;
    /** e.g. `"AES-GCM-256"`. */
    encryptionAlg: string;
    keySaltB64?: string;
    url?: string;
    folderId?: string;
    tags?: string[];
    sharedWithUserIds?: string[];
    sharedWithTeamIds?: string[];
    expiresAt?: string;
    lastRotatedAt?: string;
    lastAccessedAt?: string;
    strength?: 'weak' | 'fair' | 'good' | 'strong' | string;
    reused?: boolean;
    breached?: boolean;
    attachments?: string[];
    status?: 'active' | 'archived' | 'deleted' | string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabvaultSecretCreateInput {
    name: string;
    kind: SabvaultSecretKind;
    encryptedPayloadB64: string;
    encryptionAlg?: string;
    keySaltB64?: string;
    url?: string;
    folderId?: string;
    tags?: string[];
    attachments?: string[];
    expiresAt?: string;
}

export interface SabvaultSecretUpdateInput {
    name?: string;
    kind?: SabvaultSecretKind;
    encryptedPayloadB64?: string;
    encryptionAlg?: string;
    url?: string;
    folderId?: string;
    tags?: string[];
    attachments?: string[];
    expiresAt?: string;
    strength?: string;
    reused?: boolean;
    breached?: boolean;
    /** Stamps `lastRotatedAt = now()` server-side. */
    markRotated?: boolean;
    status?: 'active' | 'archived';
}

export interface SabvaultSecretListParams {
    q?: string;
    page?: number;
    limit?: number;
    status?: 'active' | 'archived' | 'all';
    folderId?: string;
    kind?: SabvaultSecretKind;
}

export interface SabvaultSecretListResult {
    items: SabvaultSecretDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

const BASE = '/v1/sabvault/secrets';

function qs(p?: SabvaultSecretListParams): string {
    const sp = new URLSearchParams();
    if (p?.q?.trim()) sp.set('q', p.q.trim());
    if (typeof p?.page === 'number' && p.page >= 0) sp.set('page', String(Math.floor(p.page)));
    if (typeof p?.limit === 'number' && p.limit > 0) sp.set('limit', String(Math.min(100, Math.floor(p.limit))));
    if (p?.status) sp.set('status', p.status);
    if (p?.folderId) sp.set('folderId', p.folderId);
    if (p?.kind) sp.set('kind', p.kind);
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabvaultSecretsApi = {
    async list(params?: SabvaultSecretListParams): Promise<SabvaultSecretListResult> {
        const raw = await rustFetch<SabvaultSecretListResult>(`${BASE}${qs(params)}`);
        return raw;
    },

    async getById(id: string): Promise<SabvaultSecretDoc | null> {
        if (!id) return null;
        try {
            return await rustFetch<SabvaultSecretDoc>(`${BASE}/${encodeURIComponent(id)}`);
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            throw e;
        }
    },

    async create(input: SabvaultSecretCreateInput): Promise<{ id: string; entity: SabvaultSecretDoc }> {
        return await rustFetch(`${BASE}`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async update(id: string, patch: SabvaultSecretUpdateInput): Promise<SabvaultSecretDoc> {
        return await rustFetch(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    },

    async delete(id: string): Promise<{ deleted: boolean }> {
        try {
            return await rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { deleted: false };
            }
            throw e;
        }
    },
};
