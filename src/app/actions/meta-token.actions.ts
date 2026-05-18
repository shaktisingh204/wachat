'use server';

/**
 * =================================================================
 *  Meta Token Management & Cross-Platform Utilities
 * =================================================================
 *
 *  Phase-6 migration: every body now delegates to the Rust BFF
 *  (`/v1/meta/token/*`) via the `rustClient.metaToken.*` namespace.
 *  Public function shapes and return contracts are preserved exactly so
 *  existing call sites keep compiling without changes.
 *
 *  Graph API version: v23.0 (pinned in the Rust crate as well).
 */

import { rustClient } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';

// =================================================================
//  TOKEN INSPECTION & VALIDATION
// =================================================================

export async function inspectToken(accessToken: string): Promise<{ tokenInfo?: any; error?: string }> {
    try {
        const { tokenInfo } = await rustClient.metaToken.inspectToken(accessToken);
        return { tokenInfo };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function inspectProjectToken(projectId: string): Promise<{
    tokenInfo?: {
        app_id: string;
        type: string;
        is_valid: boolean;
        expires_at: number;
        scopes: string[];
        user_id?: string;
        profile_id?: string;
    };
    error?: string;
}> {
    try {
        const { tokenInfo } = await rustClient.metaToken.inspectProjectToken(projectId);
        // Rust serializes Meta-shape fields (app_id / is_valid / …) verbatim.
        return { tokenInfo: tokenInfo as any };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function isTokenValid(projectId: string): Promise<{ valid: boolean; expiresAt?: number; error?: string }> {
    try {
        const res = await rustClient.metaToken.isTokenValid(projectId);
        return { valid: res.valid, expiresAt: res.expiresAt };
    } catch (e: any) {
        return { valid: false, error: getErrorMessage(e) };
    }
}

export async function getTokenScopes(projectId: string): Promise<{ scopes?: string[]; error?: string }> {
    try {
        const { scopes } = await rustClient.metaToken.getTokenScopes(projectId);
        return { scopes };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  TOKEN EXCHANGE & REFRESH
// =================================================================

export async function exchangeShortLivedToken(shortLivedToken: string): Promise<{ longLivedToken?: string; expiresIn?: number; error?: string }> {
    try {
        const res = await rustClient.metaToken.exchangeShortLivedToken(shortLivedToken);
        return { longLivedToken: res.longLivedToken, expiresIn: res.expiresIn };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function refreshProjectToken(projectId: string): Promise<{ success: boolean; expiresIn?: number; error?: string }> {
    try {
        const res = await rustClient.metaToken.refreshProjectToken(projectId);
        return { success: res.success, expiresIn: res.expiresIn };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getPageTokenFromUserToken(userToken: string, pageId: string): Promise<{ pageToken?: string; error?: string }> {
    try {
        const { pageToken } = await rustClient.metaToken.getPageTokenFromUserToken(userToken, pageId);
        return { pageToken };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  APP ACCESS TOKEN (for server-to-server calls)
// =================================================================

export async function getAppAccessToken(): Promise<{ appToken?: string; error?: string }> {
    try {
        const { appToken } = await rustClient.metaToken.getAppAccessToken();
        return { appToken };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  PERMISSIONS CHECK
// =================================================================

export async function getGrantedPermissions(accessToken: string): Promise<{ permissions?: { permission: string; status: string }[]; error?: string }> {
    try {
        const { permissions } = await rustClient.metaToken.getGrantedPermissions(accessToken);
        return { permissions };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getProjectPermissions(projectId: string): Promise<{ permissions?: { permission: string; status: string }[]; error?: string }> {
    try {
        const { permissions } = await rustClient.metaToken.getProjectPermissions(projectId);
        return { permissions };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function checkPermission(projectId: string, permission: string): Promise<{ granted: boolean; error?: string }> {
    try {
        const { granted } = await rustClient.metaToken.checkPermission(projectId, permission);
        return { granted };
    } catch (e: any) {
        return { granted: false, error: getErrorMessage(e) };
    }
}

// =================================================================
//  RATE LIMIT STATUS
// =================================================================

export async function getApiUsageStatus(projectId: string): Promise<{ usage?: any; error?: string }> {
    try {
        const { usage } = await rustClient.metaToken.getApiUsageStatus(projectId);
        return { usage };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  CROSS-PLATFORM: BATCH API REQUESTS
// =================================================================

export async function batchGraphRequests(
    projectId: string,
    requests: { method: 'GET' | 'POST' | 'DELETE'; relative_url: string; body?: string }[]
): Promise<{ responses?: any[]; error?: string }> {
    try {
        const { responses } = await rustClient.metaToken.batchGraphRequests(projectId, requests);
        return { responses: responses as any[] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  USER IDENTITY (Me endpoint)
// =================================================================

export async function getMetaUserIdentity(accessToken: string): Promise<{ user?: any; error?: string }> {
    try {
        const { user } = await rustClient.metaToken.getMetaUserIdentity(accessToken);
        return { user };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getMetaUserAccounts(accessToken: string): Promise<{ accounts?: any[]; error?: string }> {
    try {
        const { accounts } = await rustClient.metaToken.getMetaUserAccounts(accessToken);
        return { accounts: accounts as any[] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getMetaUserBusinesses(accessToken: string): Promise<{ businesses?: any[]; error?: string }> {
    try {
        const { businesses } = await rustClient.metaToken.getMetaUserBusinesses(accessToken);
        return { businesses: businesses as any[] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
