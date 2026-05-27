/** TS client for `/v1/sabcatalyst/auth-sessions/*`. */
import 'server-only';
import { rustFetch } from './fetcher';

export interface SabcatalystAuthSession {
    _id: string;
    authUserId: string;
    projectId: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
    revoked: boolean;
    ip?: string;
    userAgent?: string;
    createdAt: string;
}

export interface ListSessionsResponse { items: SabcatalystAuthSession[]; nextCursor?: string }

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystAuthSessionsApi = {
    list: (params: { projectId?: string; authUserId?: string; limit?: number; cursor?: string }) =>
        rustFetch<ListSessionsResponse>(`/v1/sabcatalyst/auth-sessions/${qs(params)}`),
    issue: (body: {
        authUserId: string;
        projectId: string;
        tokenHash: string;
        expiresAt: string;
        ip?: string;
        userAgent?: string;
    }) =>
        rustFetch<SabcatalystAuthSession>('/v1/sabcatalyst/auth-sessions/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    revoke: (id: string) =>
        rustFetch<void>(`/v1/sabcatalyst/auth-sessions/${id}`, { method: 'DELETE' }),
};
