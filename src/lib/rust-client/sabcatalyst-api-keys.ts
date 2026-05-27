/** TS client for `/v1/sabcatalyst/api-keys/*`. */
import 'server-only';
import { rustFetch } from './fetcher';

export type ApiKeyScope = 'read' | 'write' | 'admin';
export type ApiKeyStatus = 'active' | 'revoked';

export interface SabcatalystApiKey {
    _id: string;
    projectId: string;
    userId: string;
    label: string;
    keyHash: string;
    scope: ApiKeyScope;
    lastUsedAt?: string;
    expiresAt?: string;
    status: ApiKeyStatus;
    createdAt: string;
}

export interface ListKeysResponse { items: SabcatalystApiKey[]; nextCursor?: string }

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystApiKeysApi = {
    list: (params: { projectId: string; limit?: number; cursor?: string }) =>
        rustFetch<ListKeysResponse>(`/v1/sabcatalyst/api-keys/${qs(params)}`),
    create: (body: {
        projectId: string;
        label: string;
        keyHash: string;
        scope?: ApiKeyScope;
        expiresAt?: string;
    }) =>
        rustFetch<SabcatalystApiKey>('/v1/sabcatalyst/api-keys/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    revoke: (id: string) =>
        rustFetch<void>(`/v1/sabcatalyst/api-keys/${id}`, { method: 'DELETE' }),
    /** Service-to-service lookup used by runtime route auth. */
    lookup: (body: { projectId: string; keyHash: string }) =>
        rustFetch<SabcatalystApiKey>('/v1/sabcatalyst/api-keys/lookup', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
