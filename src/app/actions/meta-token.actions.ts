

'use server';

/**
 * =================================================================
 *  Meta Token Management & Cross-Platform Utilities
 * =================================================================
 *
 *  Shared token inspection, refresh, and cross-platform utilities
 *  for all Meta Graph API integrations (Facebook, Instagram, WhatsApp,
 *  Threads, Ad Manager, Business Manager).
 *
 *  Graph API version: v23.0
 */

import axios from 'axios';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/project.actions';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

const API_VERSION = 'v23.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;


// =================================================================
//  TOKEN INSPECTION & VALIDATION
// =================================================================

export async function inspectToken(accessToken: string): Promise<{ tokenInfo?: any; error?: string }> {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) return { error: 'Server credentials not configured.' };

    try {
        const appToken = `${appId}|${appSecret}`;
        const response = await axios.get(`${GRAPH}/debug_token`, {
            params: { input_token: accessToken, access_token: appToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { tokenInfo: response.data.data };
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
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or token missing.' };
    return inspectToken(project.accessToken);
}

export async function isTokenValid(projectId: string): Promise<{ valid: boolean; expiresAt?: number; error?: string }> {
    const { tokenInfo, error } = await inspectProjectToken(projectId);
    if (error) return { valid: false, error };
    return {
        valid: tokenInfo?.is_valid === true,
        expiresAt: tokenInfo?.expires_at,
    };
}

export async function getTokenScopes(projectId: string): Promise<{ scopes?: string[]; error?: string }> {
    const { tokenInfo, error } = await inspectProjectToken(projectId);
    if (error) return { error };
    return { scopes: tokenInfo?.scopes || [] };
}


// =================================================================
//  TOKEN EXCHANGE & REFRESH
// =================================================================

export async function exchangeShortLivedToken(shortLivedToken: string): Promise<{ longLivedToken?: string; expiresIn?: number; error?: string }> {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) return { error: 'Server credentials not configured.' };

    try {
        const response = await axios.get(`${GRAPH}/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: shortLivedToken,
            }
        });
        return {
            longLivedToken: response.data.access_token,
            expiresIn: response.data.expires_in,
        };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function refreshProjectToken(projectId: string): Promise<{ success: boolean; expiresIn?: number; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Project not found or token missing.' };

    const { longLivedToken, expiresIn, error } = await exchangeShortLivedToken(project.accessToken);
    if (error || !longLivedToken) return { success: false, error: error || 'Failed to refresh token.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: project._id },
            { $set: { accessToken: longLivedToken, tokenRefreshedAt: new Date() } }
        );
        return { success: true, expiresIn };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getPageTokenFromUserToken(userToken: string, pageId: string): Promise<{ pageToken?: string; error?: string }> {
    try {
        const response = await axios.get(`${GRAPH}/${pageId}`, {
            params: { fields: 'access_token', access_token: userToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { pageToken: response.data.access_token };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  APP ACCESS TOKEN (for server-to-server calls)
// =================================================================

export async function getAppAccessToken(): Promise<{ appToken?: string; error?: string }> {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) return { error: 'Server credentials not configured.' };

    try {
        const response = await axios.get(`${GRAPH}/oauth/access_token`, {
            params: {
                client_id: appId,
                client_secret: appSecret,
                grant_type: 'client_credentials',
            }
        });
        return { appToken: response.data.access_token };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PERMISSIONS CHECK
// =================================================================

export async function getGrantedPermissions(accessToken: string): Promise<{ permissions?: { permission: string; status: string }[]; error?: string }> {
    try {
        const response = await axios.get(`${GRAPH}/me/permissions`, {
            params: { access_token: accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { permissions: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getProjectPermissions(projectId: string): Promise<{ permissions?: { permission: string; status: string }[]; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or token missing.' };
    return getGrantedPermissions(project.accessToken);
}

export async function checkPermission(projectId: string, permission: string): Promise<{ granted: boolean; error?: string }> {
    const { permissions, error } = await getProjectPermissions(projectId);
    if (error) return { granted: false, error };
    const perm = permissions?.find(p => p.permission === permission);
    return { granted: perm?.status === 'granted' };
}


// =================================================================
//  RATE LIMIT STATUS
// =================================================================

export async function getApiUsageStatus(projectId: string): Promise<{ usage?: any; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or token missing.' };

    try {
        // Make a lightweight call and inspect headers for usage info
        const response = await axios.get(`${GRAPH}/me`, {
            params: { fields: 'id', access_token: project.accessToken }
        });
        const appUsage = response.headers['x-app-usage'];
        const businessUsage = response.headers['x-business-use-case-usage'];

        return {
            usage: {
                app: appUsage ? JSON.parse(appUsage) : null,
                business: businessUsage ? JSON.parse(businessUsage) : null,
            }
        };
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
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    if (requests.length > 50) {
        return { error: 'Batch API supports a maximum of 50 requests per call.' };
    }

    try {
        const response = await axios.post(`${GRAPH}/`, {
            access_token: project.accessToken,
            batch: JSON.stringify(requests),
        });
        return { responses: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  USER IDENTITY (Me endpoint)
// =================================================================

export async function getMetaUserIdentity(accessToken: string): Promise<{ user?: any; error?: string }> {
    try {
        const response = await axios.get(`${GRAPH}/me`, {
            params: { fields: 'id,name,email,picture', access_token: accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { user: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getMetaUserAccounts(accessToken: string): Promise<{ accounts?: any[]; error?: string }> {
    try {
        const response = await axios.get(`${GRAPH}/me/accounts`, {
            params: { fields: 'id,name,access_token,category,tasks,picture{url}', access_token: accessToken, limit: 100 }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { accounts: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getMetaUserBusinesses(accessToken: string): Promise<{ businesses?: any[]; error?: string }> {
    try {
        const response = await axios.get(`${GRAPH}/me/businesses`, {
            params: { fields: 'id,name,link,created_time,verification_status', access_token: accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { businesses: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
