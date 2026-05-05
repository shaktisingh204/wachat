/**
 * Client for the Meta-token router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/meta/token` by the `meta-token`
 * crate (Phase 6). Each method is a one-line shim around {@link rustFetch}.
 *
 *   POST   /inspect                                  → inspectToken
 *   GET    /projects/:id/inspect                     → inspectProjectToken
 *   GET    /projects/:id/is-valid                    → isTokenValid
 *   GET    /projects/:id/scopes                      → getTokenScopes
 *
 *   POST   /exchange-short-lived                     → exchangeShortLivedToken
 *   POST   /projects/:id/refresh                     → refreshProjectToken
 *
 *   POST   /page-token                               → getPageTokenFromUserToken
 *   GET    /app-access-token                         → getAppAccessToken
 *
 *   POST   /permissions                              → getGrantedPermissions
 *   GET    /projects/:id/permissions                 → getProjectPermissions
 *   GET    /projects/:id/permissions/:perm           → checkPermission
 *
 *   GET    /projects/:id/usage                       → getApiUsageStatus
 *   POST   /projects/:id/batch                       → batchGraphRequests
 *
 *   POST   /me                                       → getMetaUserIdentity
 *   POST   /me/accounts                              → getMetaUserAccounts
 *   POST   /me/businesses                            → getMetaUserBusinesses
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/meta/token';

// ---------------------------------------------------------------------------
// DTOs (mirror the Rust crate). Token info uses Meta wire snake_case so the
// returned shape matches the legacy `meta-token.actions.ts` exactly.
// ---------------------------------------------------------------------------

export interface TokenInfo {
    app_id?: string;
    type?: string;
    is_valid: boolean;
    expires_at: number;
    scopes: string[];
    user_id?: string;
    profile_id?: string;
}

export interface PermissionEntry {
    permission: string;
    status: string;
}

export interface UsageStatus {
    app: unknown;
    business: unknown;
}

export interface BatchRequest {
    method: 'GET' | 'POST' | 'DELETE';
    relative_url: string;
    body?: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const metaTokenApi = {
    inspectToken: (accessToken: string) =>
        rustFetch<{ tokenInfo: TokenInfo }>(`${BASE}/inspect`, {
            method: 'POST',
            body: JSON.stringify({ accessToken }),
        }),

    inspectProjectToken: (projectId: string) =>
        rustFetch<{ tokenInfo: TokenInfo }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/inspect`,
        ),

    isTokenValid: (projectId: string) =>
        rustFetch<{ valid: boolean; expiresAt?: number }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/is-valid`,
        ),

    getTokenScopes: (projectId: string) =>
        rustFetch<{ scopes: string[] }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/scopes`,
        ),

    exchangeShortLivedToken: (shortLivedToken: string) =>
        rustFetch<{ longLivedToken: string; expiresIn?: number }>(
            `${BASE}/exchange-short-lived`,
            {
                method: 'POST',
                body: JSON.stringify({ shortLivedToken }),
            },
        ),

    refreshProjectToken: (projectId: string) =>
        rustFetch<{ success: boolean; expiresIn?: number }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/refresh`,
            { method: 'POST' },
        ),

    getPageTokenFromUserToken: (userToken: string, pageId: string) =>
        rustFetch<{ pageToken: string }>(`${BASE}/page-token`, {
            method: 'POST',
            body: JSON.stringify({ userToken, pageId }),
        }),

    getAppAccessToken: () =>
        rustFetch<{ appToken: string }>(`${BASE}/app-access-token`),

    getGrantedPermissions: (accessToken: string) =>
        rustFetch<{ permissions: PermissionEntry[] }>(`${BASE}/permissions`, {
            method: 'POST',
            body: JSON.stringify({ accessToken }),
        }),

    getProjectPermissions: (projectId: string) =>
        rustFetch<{ permissions: PermissionEntry[] }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/permissions`,
        ),

    checkPermission: (projectId: string, permission: string) =>
        rustFetch<{ granted: boolean }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/permissions/${encodeURIComponent(permission)}`,
        ),

    getApiUsageStatus: (projectId: string) =>
        rustFetch<{ usage: UsageStatus }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/usage`,
        ),

    batchGraphRequests: (projectId: string, requests: BatchRequest[]) =>
        rustFetch<{ responses: unknown[] }>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/batch`,
            {
                method: 'POST',
                body: JSON.stringify({ requests }),
            },
        ),

    getMetaUserIdentity: (accessToken: string) =>
        rustFetch<{ user: unknown }>(`${BASE}/me`, {
            method: 'POST',
            body: JSON.stringify({ accessToken }),
        }),

    getMetaUserAccounts: (accessToken: string) =>
        rustFetch<{ accounts: unknown[] }>(`${BASE}/me/accounts`, {
            method: 'POST',
            body: JSON.stringify({ accessToken }),
        }),

    getMetaUserBusinesses: (accessToken: string) =>
        rustFetch<{ businesses: unknown[] }>(`${BASE}/me/businesses`, {
            method: 'POST',
            body: JSON.stringify({ accessToken }),
        }),
};

export type MetaTokenApi = typeof metaTokenApi;
