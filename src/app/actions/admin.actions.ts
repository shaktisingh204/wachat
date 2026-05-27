'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getErrorMessage } from '@/lib/utils';
import { createAdminSessionToken } from '@/lib/auth';
import { sessionCookieOptions } from '@/lib/cookies';
import { getAdminSession } from '@/lib/admin-session';
import { rustClient, RustApiError } from '@/lib/rust-client';

// Server-action wrapper so client components can call getAdminSession via RPC.
// Server components should import from '@/lib/admin-session' directly.
export async function checkAdminSession() {
    return getAdminSession();
}

/**
 * Translate a {@link RustApiError} into the `{ success, error }` shape the
 * legacy callers expect. `kind` decides the message used for auth failures —
 * `'admin'` flips 401/403 to "Permission denied." while `'login'` returns
 * the more generic "Invalid credentials." so we don't leak which factor
 * (email vs. password) was wrong.
 */
function translateRustError(
    e: unknown,
    kind: 'admin' | 'login' = 'admin',
    fallback = 'An unexpected server error occurred.',
): { success: false; error: string } {
    if (e instanceof RustApiError) {
        if (e.status === 401 || e.status === 403) {
            return {
                success: false,
                error:
                    kind === 'login'
                        ? 'Invalid credentials.'
                        : 'Permission denied.',
            };
        }
        if (e.status === 400 || e.status === 409) {
            return { success: false, error: e.message || fallback };
        }
        return { success: false, error: e.message || fallback };
    }
    return { success: false, error: getErrorMessage(e) || fallback };
}

export async function setWebhookProcessingStatus(enabled: boolean) {
    try {
        await rustClient.admin.settings.setWebhookProcessing(enabled);
        return { success: true };
    } catch (e: any) {
        return translateRustError(e);
    }
}

export async function getWebhookProcessingStatus(): Promise<{ enabled: boolean }> {
    try {
        const res = await rustClient.admin.settings.getWebhookProcessing();
        // Default to enabled if not explicitly set to false
        return { enabled: res.enabled !== false };
    } catch (e: any) {
        console.error('Failed to get webhook processing status:', e);
        return { enabled: true }; // Fail-safe to enabled
    }
}

/**
 * Returns true when an admin credential document exists on the backend.
 * The login page uses this to decide between showing the login form
 * or the first-time setup form.
 */
export async function isAdminConfigured(): Promise<boolean> {
    try {
        const res = await rustClient.admin.auth.isConfigured();
        return !!res.configured;
    } catch {
        return false;
    }
}

/**
 * First-time admin setup. Delegates credential storage to the Rust backend
 * (which refuses to run if an admin already exists, so this endpoint can't
 * be used to hijack an existing deployment). The cookie is then minted in
 * TS — Rust never sees the Next.js session cookie.
 */
export async function setupInitialAdmin(prevState: any, formData: FormData) {
    const email = (formData.get('email') as string | null)?.trim().toLowerCase();
    const password = formData.get('password') as string | null;
    const confirm = formData.get('confirmPassword') as string | null;

    if (!process.env.JWT_SECRET) {
        return { success: false, error: 'Server misconfiguration: JWT_SECRET is not set.' };
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: 'Enter a valid email address.' };
    }
    if (!password || password.length < 10) {
        return { success: false, error: 'Password must be at least 10 characters.' };
    }
    if (password !== confirm) {
        return { success: false, error: 'Passwords do not match.' };
    }

    try {
        await rustClient.admin.auth.setup({
            email,
            password,
            confirmPassword: confirm,
        });

        // Auto-login right after setup so the user lands on the dashboard.
        const token = await createAdminSessionToken();
        const cookieStore = await cookies();
        cookieStore.set('admin_session', token, sessionCookieOptions(60 * 60 * 24));

        return { success: true };
    } catch (e: any) {
        console.error('[ADMIN_SETUP] FATAL:', e);
        return translateRustError(e);
    }
}

export async function handleAdminLogin(prevState: any, formData: FormData) {
    const email = (formData.get('email') as string | null)?.trim().toLowerCase();
    const password = formData.get('password') as string | null;

    if (!process.env.JWT_SECRET) {
        return { success: false, error: 'Server misconfiguration: JWT_SECRET is not set.' };
    }
    if (!email || !password) {
        return { success: false, error: 'Email and password are required.' };
    }

    try {
        await rustClient.admin.auth.login({ email, password });

        // Rust only verifies the password — cookie minting stays in TS.
        const token = await createAdminSessionToken();
        const cookieStore = await cookies();
        cookieStore.set('admin_session', token, sessionCookieOptions(60 * 60 * 24));

        return { success: true };
    } catch (e: any) {
        // 404 from the backend means no admin has been configured yet —
        // surface the sentinel string the login page checks for so it can
        // swap to the setup form.
        if (e instanceof RustApiError) {
            if (e.status === 404 || e.code === 'NEEDS_SETUP') {
                return { success: false, error: 'NEEDS_SETUP' };
            }
            if (e.status === 401 || e.status === 403) {
                return { success: false, error: 'Invalid credentials.' };
            }
        }
        console.error('[ADMIN_LOGIN] FATAL:', e);
        return translateRustError(e, 'login');
    }
}

export async function getProjectsForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string,
): Promise<{ projects: any[]; total: number }> {
    try {
        const res = await rustClient.admin.projects.list({ page, limit, query });
        return { projects: res.projects ?? [], total: res.total ?? 0 };
    } catch (e) {
        console.error('Failed to fetch projects for admin:', e);
        return { projects: [], total: 0 };
    }
}

export async function handleDeleteProjectByAdmin(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    if (!projectId) {
        return { error: 'Invalid Project ID.' };
    }

    try {
        await rustClient.admin.projects.delete(projectId);
        revalidatePath('/admin/dashboard');
        return { message: 'Project deleted successfully.' };
    } catch (e: any) {
        if (e instanceof RustApiError) {
            if (e.status === 401 || e.status === 403) {
                return { error: 'Permission denied.' };
            }
            return { error: e.message || getErrorMessage(e) };
        }
        return { error: getErrorMessage(e) };
    }
}

export async function updateProjectCreditsByAdmin(
    projectId: string,
    credits: number,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'Invalid project ID.' };
    if (isNaN(credits) || credits < 0) {
        return { success: false, error: 'Invalid credits amount.' };
    }

    try {
        await rustClient.admin.projects.updateCredits(projectId, Number(credits));
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return translateRustError(e);
    }
}

export async function updateProjectMpsByAdmin(
    projectId: string,
    mps: number,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'Invalid project ID.' };
    if (isNaN(mps) || mps < 1) return { success: false, error: 'Invalid MPS value.' };

    try {
        await rustClient.admin.projects.updateMps(projectId, Number(mps));
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return translateRustError(e);
    }
}

export async function updateProjectPlanByAdmin(
    projectId: string,
    planId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !planId) {
        return { success: false, error: 'Invalid project or plan ID.' };
    }

    try {
        await rustClient.admin.projects.updatePlan(projectId, planId);
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return translateRustError(e);
    }
}

export async function updateUserPlanByAdmin(
    userId: string,
    planId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!userId || !planId) {
        return { success: false, error: 'Invalid user or plan ID.' };
    }

    try {
        await rustClient.admin.users.updatePlan(userId, planId);
        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e: any) {
        return translateRustError(e);
    }
}

type AdminStats = {
    core: {
        totalUsers: number;
        approvedUsers: number;
        pendingUsers: number;
        totalProjects: number;
        totalWabas: number;
        totalPlans: number;
        totalTransactions: number;
    };
    wachat: {
        broadcasts: number;
        outgoingMessages: number;
        incomingMessages: number;
        contacts: number;
        templates: number;
        libraryTemplates: number;
        flows: number;
        flowLogs: number;
        cannedMessages: number;
        activityLogs: number;
    };
    crm: {
        contacts: number;
        leads: number;
        deals: number;
        invoices: number;
        quotations: number;
        salesOrders: number;
        purchaseOrders: number;
        expenses: number;
        products: number;
        employees: number;
        vendors: number;
        tasks: number;
        automations: number;
        forms: number;
        formSubmissions: number;
        voucherEntries: number;
    };
    ads: {
        adCampaigns: number;
        facebookBroadcasts: number;
        facebookFlows: number;
        facebookSubscribers: number;
        metaFlows: number;
    };
    marketing: {
        emailCampaigns: number;
        emailContacts: number;
        emailTemplates: number;
        smsCampaigns: number;
        smsLogs: number;
    };
    platform: {
        seoProjects: number;
        seoAudits: number;
        seoKeywords: number;
        sabflows: number;
        sabflowExecutions: number;
        sabchatSessions: number;
        teamChannels: number;
        teamMessages: number;
        teamTasks: number;
        notifications: number;
    };
    tools: {
        shortUrls: number;
        qrCodes: number;
        ecommShops: number;
        ecommProducts: number;
        ecommOrders: number;
        websitePages: number;
    };
};

function emptyAdminStats(): AdminStats {
    return {
        core: { totalUsers: 0, approvedUsers: 0, pendingUsers: 0, totalProjects: 0, totalWabas: 0, totalPlans: 0, totalTransactions: 0 },
        wachat: { broadcasts: 0, outgoingMessages: 0, incomingMessages: 0, contacts: 0, templates: 0, libraryTemplates: 0, flows: 0, flowLogs: 0, cannedMessages: 0, activityLogs: 0 },
        crm: { contacts: 0, leads: 0, deals: 0, invoices: 0, quotations: 0, salesOrders: 0, purchaseOrders: 0, expenses: 0, products: 0, employees: 0, vendors: 0, tasks: 0, automations: 0, forms: 0, formSubmissions: 0, voucherEntries: 0 },
        ads: { adCampaigns: 0, facebookBroadcasts: 0, facebookFlows: 0, facebookSubscribers: 0, metaFlows: 0 },
        marketing: { emailCampaigns: 0, emailContacts: 0, emailTemplates: 0, smsCampaigns: 0, smsLogs: 0 },
        platform: { seoProjects: 0, seoAudits: 0, seoKeywords: 0, sabflows: 0, sabflowExecutions: 0, sabchatSessions: 0, teamChannels: 0, teamMessages: 0, teamTasks: 0, notifications: 0 },
        tools: { shortUrls: 0, qrCodes: 0, ecommShops: 0, ecommProducts: 0, ecommOrders: 0, websitePages: 0 },
    };
}

export async function getAdminDashboardStats(): Promise<AdminStats> {
    try {
        return await rustClient.admin.stats.dashboardStats();
    } catch (e) {
        console.error('Failed to fetch admin stats:', e);
        return emptyAdminStats();
    }
}

/**
 * Set / clear the global app logo.
 *
 * Per SabFiles policy, file inputs always come from SabFiles — so this action
 * accepts only a `logoUrl` string. An empty / missing url clears the logo
 * (Rust receives `url: null`).
 */
export async function setAppLogo(prevState: any, formData: FormData) {
    const rawUrl = formData.get('logoUrl');
    const logoUrl =
        typeof rawUrl === 'string' && rawUrl.trim().length > 0
            ? rawUrl.trim()
            : null;

    try {
        await rustClient.admin.settings.setAppLogo(logoUrl);
        return {
            success: true,
            message: logoUrl ? 'App logo updated.' : 'Logo reset to default.',
        };
    } catch (e: any) {
        if (e instanceof RustApiError && (e.status === 401 || e.status === 403)) {
            return { error: 'Permission denied.' };
        }
        return { error: getErrorMessage(e) };
    }
}

export async function getAppLogoUrl(): Promise<string | null> {
    try {
        const res = await rustClient.admin.settings.getAppLogo();
        return res.url ?? null;
    } catch (e) {
        return null;
    }
}

export async function approveUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!userId) return { success: false, error: 'Invalid user ID.' };

    try {
        await rustClient.admin.users.approve(userId);
        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e: any) {
        if (e instanceof RustApiError && e.status === 404) {
            return { success: false, error: 'User not found.' };
        }
        return translateRustError(e);
    }
}

export async function setDiwaliThemeStatus(
    enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
    try {
        await rustClient.admin.settings.setDiwaliTheme(enabled);
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (e: any) {
        return translateRustError(e);
    }
}

export async function getDiwaliThemeStatus(): Promise<{ enabled: boolean }> {
    try {
        const res = await rustClient.admin.settings.getDiwaliTheme();
        return { enabled: !!res.enabled };
    } catch (e) {
        return { enabled: false };
    }
}

export async function impersonateUser(
    userId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!userId) {
        return { success: false, error: 'Invalid user ID.' };
    }

    try {
        // Rust returns the basic identity for the target user; cookie minting
        // stays in TS so we keep the session-token shape callers expect.
        const target = await rustClient.admin.users.impersonate(userId);

        const sessionPayload = {
            userId: String(target.userId),
            email: target.email,
            name: target.name ?? undefined,
            role: 'user', // Basic role, permissions handle the rest
            planId: target.planId ?? undefined,
            projectLimit: 0, // Will be fetched from plan
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
        };

        const { createSessionToken } = await import('@/lib/auth');
        const token = await createSessionToken(sessionPayload);

        const cookieStore = await cookies();
        cookieStore.set('session', token, sessionCookieOptions(7 * 24 * 60 * 60));

        return { success: true };
    } catch (e: any) {
        if (e instanceof RustApiError && e.status === 404) {
            return { success: false, error: 'User not found.' };
        }
        return translateRustError(e);
    }
}

export async function updateUserPermissions(
    userId: string,
    permissions: any,
): Promise<{ success: boolean; error?: string }> {
    if (!userId) return { success: false, error: 'Invalid user ID.' };

    try {
        await rustClient.admin.users.updatePermissions(userId, permissions);
        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e: any) {
        return translateRustError(e);
    }
}

export async function updatePlanPermissions(
    planId: string,
    permissions: any,
): Promise<{ success: boolean; error?: string }> {
    if (!planId) return { success: false, error: 'Invalid plan ID.' };

    try {
        await rustClient.admin.plans.updatePermissions(planId, permissions);
        revalidatePath('/admin/dashboard/plans');
        return { success: true };
    } catch (e: any) {
        return translateRustError(e);
    }
}

export async function bulkApproveUsers(userIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
        await Promise.all(userIds.map(id => approveUser(id)));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function bulkUpdateUserPlans(userIds: string[], planId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await Promise.all(userIds.map(id => updateUserPlanByAdmin(id, planId)));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
