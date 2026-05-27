/** TS client for `/v1/sabcatalyst/auth-users/*` — end-user identity. */
import 'server-only';
import { rustFetch } from './fetcher';

export type AuthUserStatus = 'active' | 'disabled';

export interface SabcatalystAuthUser {
    _id: string;
    projectId: string;
    userId: string;
    email: string;
    hashedPassword: string;
    emailVerified: boolean;
    status: AuthUserStatus;
    metadataJson?: Record<string, unknown>;
    lastSignInAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListAuthUsersResponse {
    items: SabcatalystAuthUser[];
    nextCursor?: string;
}

function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const sabcatalystAuthUsersApi = {
    list: (params: { projectId: string; q?: string; limit?: number; cursor?: string }) =>
        rustFetch<ListAuthUsersResponse>(`/v1/sabcatalyst/auth-users/${qs(params)}`),
    get: (id: string) => rustFetch<SabcatalystAuthUser>(`/v1/sabcatalyst/auth-users/${id}`),
    create: (body: {
        projectId: string;
        email: string;
        /** SHA-256 hex hash of the plaintext password. */
        hashedPassword: string;
        emailVerified?: boolean;
        metadataJson?: Record<string, unknown>;
    }) =>
        rustFetch<SabcatalystAuthUser>('/v1/sabcatalyst/auth-users/', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    update: (
        id: string,
        body: Partial<{
            email: string;
            hashedPassword: string;
            emailVerified: boolean;
            status: AuthUserStatus;
            metadataJson: Record<string, unknown>;
        }>,
    ) =>
        rustFetch<SabcatalystAuthUser>(`/v1/sabcatalyst/auth-users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    delete: (id: string) =>
        rustFetch<void>(`/v1/sabcatalyst/auth-users/${id}`, { method: 'DELETE' }),
};
