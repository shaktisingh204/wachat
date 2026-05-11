/**
 * Admin-domain client for the Rust BFF.
 *
 * Every method in here hits a `/v1/admin/...` route on the Rust backend.
 *
 * The two flavors:
 * - {@link rustAdminFetch} (most methods) — verifies the `admin_session`
 *   cookie via `getAdminSession()` and mints a short-lived bearer with
 *   `roles: ["admin"]`. Use for any admin-only route.
 * - {@link rustPublicFetch} (login/setup/configured/logout) — no cookie yet,
 *   so we hit the routes anonymously and let Rust verify the password.
 *
 * Response shapes mirror what the legacy TS server actions returned, so the
 * thin proxy server actions in `src/app/actions/admin.actions.ts` can keep
 * their existing return types.
 */
import 'server-only';

import { rustAdminFetch, rustPublicFetch } from './fetcher';

// ---------------------------------------------------------------------------
// Auth — open routes
// ---------------------------------------------------------------------------

export type AdminConfiguredResponse = { configured: boolean };
export type AdminOk = { ok: true };

export const adminAuthApi = {
    isConfigured: () =>
        rustPublicFetch<AdminConfiguredResponse>('/v1/admin/configured'),

    setup: (body: { email: string; password: string; confirmPassword: string }) =>
        rustPublicFetch<AdminOk>('/v1/admin/setup', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    login: (body: { email: string; password: string }) =>
        rustPublicFetch<AdminOk>('/v1/admin/login', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    logoutRevoke: (body: { jti: string; expSeconds: number }) =>
        rustPublicFetch<AdminOk>('/v1/admin/logout/revoke', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /**
     * Verify an `admin_session` cookie token. Open route — used by
     * `getAdminSession` on the TS side instead of doing local JWT verification.
     * Returns `{ isAdmin: false }` for any failure mode (invalid signature,
     * expired, revoked, wrong role) so the caller can simply render the login
     * page.
     */
    verifySession: (token: string) =>
        rustPublicFetch<{
            isAdmin: boolean;
            user?: {
                role: string;
                loggedInAt?: number;
                jti: string;
                exp: number;
                iat: number;
            };
        }>('/v1/admin/session/verify', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type AdminProjectListResponse = { projects: any[]; total: number };
export type AdminProjectResponse = { project: any | null };

export const adminProjectsApi = {
    list: (params?: { page?: number; limit?: number; query?: string }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.query) qs.set('query', params.query);
        const s = qs.toString();
        return rustAdminFetch<AdminProjectListResponse>(
            s ? `/v1/admin/projects?${s}` : '/v1/admin/projects',
        );
    },
    byId: (id: string) =>
        rustAdminFetch<AdminProjectResponse>(`/v1/admin/projects/${id}`),
    delete: (id: string) =>
        rustAdminFetch<{ ok: boolean; message: string }>(`/v1/admin/projects/${id}`, {
            method: 'DELETE',
        }),
    updateCredits: (id: string, credits: number) =>
        rustAdminFetch<AdminOk>(`/v1/admin/projects/${id}/credits`, {
            method: 'PATCH',
            body: JSON.stringify({ credits }),
        }),
    updateMps: (id: string, mps: number) =>
        rustAdminFetch<AdminOk>(`/v1/admin/projects/${id}/mps`, {
            method: 'PATCH',
            body: JSON.stringify({ mps }),
        }),
    updatePlan: (id: string, planId: string) =>
        rustAdminFetch<AdminOk>(`/v1/admin/projects/${id}/plan`, {
            method: 'PATCH',
            body: JSON.stringify({ planId }),
        }),
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type AdminUserListResponse = { users: any[]; total: number };
export type AdminWhatsappProjectListResponse = { projects: any[]; total: number };

export const adminUsersApi = {
    list: (params?: { page?: number; limit?: number; query?: string }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.query) qs.set('query', params.query);
        const s = qs.toString();
        return rustAdminFetch<AdminUserListResponse>(
            s ? `/v1/admin/users?${s}` : '/v1/admin/users',
        );
    },
    listWhatsappProjects: (params?: { page?: number; limit?: number; query?: string }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        if (params?.query) qs.set('query', params.query);
        const s = qs.toString();
        return rustAdminFetch<AdminWhatsappProjectListResponse>(
            s ? `/v1/admin/whatsapp-projects?${s}` : '/v1/admin/whatsapp-projects',
        );
    },
    approve: (id: string) =>
        rustAdminFetch<AdminOk>(`/v1/admin/users/${id}/approve`, { method: 'POST' }),
    updatePlan: (id: string, planId: string) =>
        rustAdminFetch<AdminOk>(`/v1/admin/users/${id}/plan`, {
            method: 'PATCH',
            body: JSON.stringify({ planId }),
        }),
    updatePermissions: (id: string, permissions: any) =>
        rustAdminFetch<AdminOk>(`/v1/admin/users/${id}/permissions`, {
            method: 'PATCH',
            body: JSON.stringify({ permissions }),
        }),
    impersonate: (id: string) =>
        rustAdminFetch<{
            userId: string;
            email: string;
            name?: string | null;
            planId?: string | null;
        }>(`/v1/admin/users/${id}/impersonate`, { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Plans + library templates
// ---------------------------------------------------------------------------

export type AdminPlanListResponse = { plans: any[] };
export type AdminPlanResponse = { plan: any | null };
export type AdminLibraryTemplateListResponse = { templates: any[] };

export const adminPlansApi = {
    list: () => rustAdminFetch<AdminPlanListResponse>('/v1/admin/plans'),
    byId: (id: string) => rustAdminFetch<AdminPlanResponse>(`/v1/admin/plans/${id}`),
    create: (plan: any) =>
        rustAdminFetch<{ id: string }>('/v1/admin/plans', {
            method: 'POST',
            body: JSON.stringify(plan),
        }),
    update: (id: string, plan: any) =>
        rustAdminFetch<AdminOk>(`/v1/admin/plans/${id}`, {
            method: 'PUT',
            body: JSON.stringify(plan),
        }),
    updatePermissions: (id: string, permissions: any) =>
        rustAdminFetch<AdminOk>(`/v1/admin/plans/${id}/permissions`, {
            method: 'PATCH',
            body: JSON.stringify({ permissions }),
        }),
    delete: (id: string) =>
        rustAdminFetch<{ ok: boolean; message: string }>(`/v1/admin/plans/${id}`, {
            method: 'DELETE',
        }),
    listLibraryTemplates: () =>
        rustAdminFetch<AdminLibraryTemplateListResponse>('/v1/admin/library-templates'),
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const adminSettingsApi = {
    getWebhookProcessing: () =>
        rustAdminFetch<{ enabled: boolean }>('/v1/admin/webhook-processing'),
    setWebhookProcessing: (enabled: boolean) =>
        rustAdminFetch<AdminOk>('/v1/admin/webhook-processing', {
            method: 'POST',
            body: JSON.stringify({ enabled }),
        }),
    getAppLogo: () =>
        rustAdminFetch<{ url: string | null }>('/v1/admin/app-logo'),
    setAppLogo: (url: string | null) =>
        rustAdminFetch<AdminOk>('/v1/admin/app-logo', {
            method: 'POST',
            body: JSON.stringify({ url }),
        }),
    getDiwaliTheme: () =>
        rustAdminFetch<{ enabled: boolean }>('/v1/admin/diwali-theme'),
    setDiwaliTheme: (enabled: boolean) =>
        rustAdminFetch<AdminOk>('/v1/admin/diwali-theme', {
            method: 'POST',
            body: JSON.stringify({ enabled }),
        }),
};

// ---------------------------------------------------------------------------
// Stats + logs
// ---------------------------------------------------------------------------

export type AdminStatsResponse = {
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

export type AdminWebhookLogListResponse = { logs: any[]; total: number };
export type AdminWebhookLogPayloadResponse = { payload: any | null };
export type AdminBroadcastListResponse = { broadcasts: any[]; total: number };

export const adminStatsApi = {
    dashboardStats: () =>
        rustAdminFetch<AdminStatsResponse>('/v1/admin/dashboard-stats'),
    listWebhookLogs: (params?: {
        projectId?: string;
        page?: number;
        limit?: number;
    }) => {
        const qs = new URLSearchParams();
        if (params?.projectId) qs.set('projectId', params.projectId);
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const s = qs.toString();
        return rustAdminFetch<AdminWebhookLogListResponse>(
            s ? `/v1/admin/webhook-logs?${s}` : '/v1/admin/webhook-logs',
        );
    },
    webhookLogPayload: (id: string) =>
        rustAdminFetch<AdminWebhookLogPayloadResponse>(
            `/v1/admin/webhook-logs/${id}/payload`,
        ),
    listBroadcasts: (params?: { page?: number; limit?: number }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const s = qs.toString();
        return rustAdminFetch<AdminBroadcastListResponse>(
            s ? `/v1/admin/broadcasts?${s}` : '/v1/admin/broadcasts',
        );
    },
};

// ---------------------------------------------------------------------------
// Audit + ops
// ---------------------------------------------------------------------------

export type AdminAuditBucket = { key: string; count: number; failures: number };
export type AdminAuditSummaryResponse = {
    tenantId: string;
    range: { from: string; to: string };
    total: number;
    failures: number;
    actionsByActor: AdminAuditBucket[];
    actionsByResource: AdminAuditBucket[];
    actionsByAction: AdminAuditBucket[];
    recent: any[];
};

export const adminAuditApi = {
    summary: (params: {
        tenantId: string;
        from: string;
        to: string;
        maxEvents?: number;
        recentLimit?: number;
    }) => {
        const qs = new URLSearchParams();
        qs.set('tenantId', params.tenantId);
        qs.set('from', params.from);
        qs.set('to', params.to);
        if (params.maxEvents) qs.set('max_events', String(params.maxEvents));
        if (params.recentLimit) qs.set('recent_limit', String(params.recentLimit));
        return rustAdminFetch<AdminAuditSummaryResponse>(
            `/v1/admin/audit/summary?${qs.toString()}`,
        );
    },
};

export const adminOpsApi = {
    runCron: () =>
        rustAdminFetch<{ ok: boolean; message: string }>('/v1/admin/run-cron', {
            method: 'POST',
        }),
    syncWaba: (body: {
        userId: string;
        accessToken: string;
        appId: string;
        wabaId: string;
        groupName?: string;
    }) =>
        rustAdminFetch<{
            ok: boolean;
            message: string;
            projectId: string;
            wabaName: string;
            count: number;
        }>('/v1/admin/waba/sync', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export const adminApi = {
    auth: adminAuthApi,
    projects: adminProjectsApi,
    users: adminUsersApi,
    plans: adminPlansApi,
    settings: adminSettingsApi,
    stats: adminStatsApi,
    audit: adminAuditApi,
    ops: adminOpsApi,
};

export type AdminApi = typeof adminApi;
