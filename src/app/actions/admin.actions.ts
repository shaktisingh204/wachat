
'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { SignJWT } from 'jose';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { getErrorMessage } from '@/lib/utils';
import { comparePassword, hashPassword, verifyAdminJwt, createAdminSessionToken } from '@/lib/auth';
import { getAdminSession } from '@/lib/admin-session';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { Plan, Project, User } from '@/lib/definitions';
import cache from '@/lib/cache';

const DIWALI_THEME_KEY = 'diwali_theme_enabled';
let isDiwaliThemeEnabled: boolean | null = null;

// Server-action wrapper so client components can call getAdminSession via RPC.
// Server components should import from '@/lib/admin-session' directly.
export async function checkAdminSession() {
    return getAdminSession();
}

export async function setWebhookProcessingStatus(enabled: boolean) {
    try {
        cache.set('webhook_processing_enabled', enabled);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getWebhookProcessingStatus(): Promise<{ enabled: boolean }> {
    try {
        const status = cache.get('webhook_processing_enabled');
        // Default to enabled if not explicitly set to false
        return { enabled: status !== false };
    } catch (e: any) {
        console.error("Failed to get webhook processing status from cache:", e);
        return { enabled: true }; // Fail-safe to enabled
    }
}

/**
 * Returns true when an admin credential document exists in MongoDB.
 * The login page uses this to decide between showing the login form
 * or the first-time setup form.
 */
export async function isAdminConfigured(): Promise<boolean> {
    try {
        const { db } = await connectToDatabase();
        const stored = await db.collection('settings').findOne({ key: 'admin_credentials' });
        return !!(stored?.email && stored?.passwordHash);
    } catch {
        return false;
    }
}

/**
 * First-time admin setup. Creates the `admin_credentials` settings document
 * in MongoDB. Refuses to run if an admin already exists — so this endpoint
 * can't be used to hijack an existing deployment.
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
        const { db } = await connectToDatabase();
        const existing = await db.collection('settings').findOne({ key: 'admin_credentials' });
        if (existing?.email && existing?.passwordHash) {
            return { success: false, error: 'An admin already exists. Setup is disabled.' };
        }

        const passwordHash = await hashPassword(password);
        await db.collection('settings').updateOne(
            { key: 'admin_credentials' },
            {
                $set: {
                    key: 'admin_credentials',
                    email,
                    passwordHash,
                    updatedAt: new Date(),
                },
                $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true }
        );

        // Auto-login right after setup so the user lands on the dashboard.
        const token = await createAdminSessionToken();
        const cookieStore = await cookies();
        cookieStore.set('admin_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24,
        });

        return { success: true };
    } catch (e: any) {
        console.error('[ADMIN_SETUP] FATAL:', e);
        return { success: false, error: 'An unexpected server error occurred.' };
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

    let adminEmail: string | undefined;
    let adminPasswordHash: string | undefined;

    try {
        const { db } = await connectToDatabase();
        const stored = await db.collection('settings').findOne({ key: 'admin_credentials' });
        if (stored?.email && stored?.passwordHash) {
            adminEmail = (stored.email as string).toLowerCase();
            adminPasswordHash = stored.passwordHash as string;
        }
    } catch (e: any) {
        console.error('[ADMIN_LOGIN] DB error:', e);
        return { success: false, error: 'Database unavailable. Try again shortly.' };
    }

    if (!adminEmail || !adminPasswordHash) {
        return { success: false, error: 'NEEDS_SETUP' };
    }

    if (email !== adminEmail) {
        return { success: false, error: 'Invalid credentials.' };
    }

    try {
        const isMatch = await comparePassword(password, adminPasswordHash);
        if (!isMatch) {
            return { success: false, error: 'Invalid credentials.' };
        }

        const token = await createAdminSessionToken();
        const cookieStore = await cookies();
        cookieStore.set('admin_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 1 day
        });

        return { success: true };
    } catch (e: any) {
        console.error('[ADMIN_LOGIN] FATAL:', e);
        return { success: false, error: 'An unexpected server error occurred.' };
    }
}

export async function getProjectsForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ projects: WithId<Project>[], total: number }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { projects: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        const [projects, total] = await Promise.all([
            db.collection('projects')
                .aggregate([
                    { $match: filter },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: 'plans',
                            localField: 'planId',
                            foreignField: '_id',
                            as: 'planInfo'
                        }
                    },
                    { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
                    { $addFields: { 'plan': '$planInfo' } },
                    { $project: { planInfo: 0 } }
                ])
                .toArray(),
            db.collection('projects').countDocuments(filter)
        ]);

        return {
            projects: JSON.parse(JSON.stringify(projects)),
            total
        };

    } catch (e) {
        console.error("Failed to fetch projects for admin:", e);
        return { projects: [], total: 0 };
    }
}


export async function handleDeleteProjectByAdmin(prevState: any, formData: FormData) {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: "Permission denied." };

    const projectId = formData.get('projectId') as string;
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);

        // This is a simplified deletion. A real-world scenario would also delete
        // associated contacts, messages, broadcasts, etc. in a transaction.
        await db.collection('projects').deleteOne({ _id: projectObjectId });

        revalidatePath('/admin/dashboard');
        return { message: 'Project deleted successfully.' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProjectCreditsByAdmin(projectId: string, credits: number): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: "Permission denied." };

    if (!ObjectId.isValid(projectId)) return { success: false, error: 'Invalid project ID.' };
    if (isNaN(credits) || credits < 0) return { success: false, error: 'Invalid credits amount.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { credits: Number(credits) } }
        );
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProjectMpsByAdmin(projectId: string, mps: number): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: "Permission denied." };

    if (!ObjectId.isValid(projectId)) return { success: false, error: 'Invalid project ID.' };
    if (isNaN(mps) || mps < 1) return { success: false, error: 'Invalid MPS value.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { messagesPerSecond: Number(mps) } }
        );
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function updateProjectPlanByAdmin(projectId: string, planId: string): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: "Permission denied." };

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(planId)) {
        return { success: false, error: 'Invalid project or plan ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { planId: new ObjectId(planId) } }
        );
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateUserPlanByAdmin(userId: string, planId: string): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: "Permission denied." };

    if (!ObjectId.isValid(userId) || !ObjectId.isValid(planId)) {
        return { success: false, error: 'Invalid user or plan ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { planId: new ObjectId(planId) } }
        );
        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export type AdminStats = {
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
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return emptyAdminStats();

    try {
        const { db } = await connectToDatabase();

        // Small helper: never fail the whole dashboard because one collection is missing
        const count = (name: string, filter: any = {}): Promise<number> =>
            db.collection(name).countDocuments(filter).catch(() => 0);

        // Fire every count in parallel — one round trip from the API's perspective
        const [
            // Core
            totalUsers, approvedUsers, pendingUsers, totalProjects, totalWabas, totalPlans, totalTransactions,
            // Wachat
            broadcasts, outgoingMessages, incomingMessages, waContacts, templates, libraryTemplates, flows, flowLogs, cannedMessages, activityLogs,
            // CRM
            crmContacts, crmLeads, crmDeals, crmInvoices, crmQuotations, crmSalesOrders, crmPurchaseOrders, crmExpenses, crmProducts, crmEmployees, crmVendors, crmTasks, crmAutomations, crmForms, crmFormSubmissions, crmVoucherEntries,
            // Ads
            adCampaigns, facebookBroadcasts, facebookFlows, facebookSubscribers, metaFlows,
            // Marketing
            emailCampaigns, emailContacts, emailTemplates, smsCampaigns, smsLogs,
            // Platform
            seoProjects, seoAudits, seoKeywords, sabflows, sabflowExecutions, sabchatSessions, teamChannels, teamMessages, teamTasks, notifications,
            // Tools
            shortUrls, qrCodes, ecommShops, ecommProducts, ecommOrders, websitePages,
        ] = await Promise.all([
            // Core
            count('users'),
            count('users', { isApproved: true }),
            count('users', { isApproved: { $ne: true } }),
            count('projects'),
            count('projects', { wabaId: { $exists: true } }),
            count('plans'),
            count('transactions'),
            // Wachat
            count('broadcasts'),
            count('outgoing_messages'),
            count('incoming_messages'),
            count('contacts'),
            count('templates'),
            count('library_templates'),
            count('flows'),
            count('flow_logs'),
            count('canned_messages'),
            count('activity_logs'),
            // CRM
            count('crm_contacts'),
            count('crm_leads'),
            count('crm_deals'),
            count('crm_invoices'),
            count('crm_quotations'),
            count('crm_sales_orders'),
            count('crm_purchase_orders'),
            count('crm_expenses'),
            count('crm_products'),
            count('crm_employees'),
            count('crm_vendors'),
            count('crm_tasks'),
            count('crm_automations'),
            count('crm_forms'),
            count('crm_form_submissions'),
            count('crm_voucher_entries'),
            // Ads
            count('ad_campaigns'),
            count('facebook_broadcasts'),
            count('facebook_flows'),
            count('facebook_subscribers'),
            count('meta_flows'),
            // Marketing
            count('email_campaigns'),
            count('email_contacts'),
            count('email_templates'),
            count('sms_campaigns'),
            count('sms_logs'),
            // Platform
            count('seo_projects'),
            count('seo_audits'),
            count('seo_keywords'),
            count('sabflows'),
            count('sabflow_executions'),
            count('sabchat_sessions'),
            count('team_channels'),
            count('team_messages'),
            count('team_tasks'),
            count('notifications'),
            // Tools
            count('short_urls'),
            count('qr_codes'),
            count('ecomm_shops'),
            count('ecomm_products'),
            count('ecomm_orders'),
            count('website_pages'),
        ]);

        return {
            core: { totalUsers, approvedUsers, pendingUsers, totalProjects, totalWabas, totalPlans, totalTransactions },
            wachat: { broadcasts, outgoingMessages, incomingMessages, contacts: waContacts, templates, libraryTemplates, flows, flowLogs, cannedMessages, activityLogs },
            crm: { contacts: crmContacts, leads: crmLeads, deals: crmDeals, invoices: crmInvoices, quotations: crmQuotations, salesOrders: crmSalesOrders, purchaseOrders: crmPurchaseOrders, expenses: crmExpenses, products: crmProducts, employees: crmEmployees, vendors: crmVendors, tasks: crmTasks, automations: crmAutomations, forms: crmForms, formSubmissions: crmFormSubmissions, voucherEntries: crmVoucherEntries },
            ads: { adCampaigns, facebookBroadcasts, facebookFlows, facebookSubscribers, metaFlows },
            marketing: { emailCampaigns, emailContacts, emailTemplates, smsCampaigns, smsLogs },
            platform: { seoProjects, seoAudits, seoKeywords, sabflows, sabflowExecutions, sabchatSessions, teamChannels, teamMessages, teamTasks, notifications },
            tools: { shortUrls, qrCodes, ecommShops, ecommProducts, ecommOrders, websitePages },
        };
    } catch (e) {
        console.error("Failed to fetch admin stats:", e);
        return emptyAdminStats();
    }
}

export async function setAppLogo(prevState: any, formData: FormData) {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: "Permission denied." };

    const logoFile = formData.get('logoFile') as File;
    const logoUrl = formData.get('logoUrl') as string;

    if (!logoFile?.size && !logoUrl) {
        try {
            const { db } = await connectToDatabase();
            await db.collection('settings').deleteOne({ key: 'app_logo_url' });
            return { success: true, message: 'Logo reset to default.' };
        } catch (e: any) {
            return { error: getErrorMessage(e) };
        }
    }

    let finalLogoUrl = logoUrl;

    if (logoFile && logoFile.size > 0) {
        // In a real app, you would upload this to a CDN (S3, GCS, etc.)
        // For this demo, we'll convert to a base64 data URI
        const buffer = await logoFile.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        finalLogoUrl = `data:${logoFile.type};base64,${base64}`;
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { key: 'app_logo_url' },
            { $set: { value: finalLogoUrl, updatedAt: new Date() } },
            { upsert: true }
        );
        return { success: true, message: 'App logo updated.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getAppLogoUrl(): Promise<string | null> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ key: 'app_logo_url' });
        return setting?.value || null;
    } catch (e) {
        return null;
    }
}

export async function approveUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) {
        return { success: false, error: "Permission denied." };
    }
    if (!ObjectId.isValid(userId)) {
        return { success: false, error: "Invalid user ID." };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { isApproved: true } }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: "User not found." };
        }
        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function setDiwaliThemeStatus(enabled: boolean): Promise<{ success: boolean, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied' };

    try {
        isDiwaliThemeEnabled = enabled; // Update in-memory cache
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { key: DIWALI_THEME_KEY },
            { $set: { value: enabled, updatedAt: new Date() } },
            { upsert: true }
        );
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getDiwaliThemeStatus(): Promise<{ enabled: boolean }> {
    if (isDiwaliThemeEnabled !== null) {
        return { enabled: isDiwaliThemeEnabled };
    }
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ key: DIWALI_THEME_KEY });
        isDiwaliThemeEnabled = !!(setting?.value ?? false);
        return { enabled: isDiwaliThemeEnabled };
    } catch (e) {
        return { enabled: false };
    }
}




export async function impersonateUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: "Permission denied." };

    if (!userId || !ObjectId.isValid(userId)) {
        return { success: false, error: "Invalid user ID." };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return { success: false, error: "User not found." };
        }

        // Generate a session token for this user
        // We'll use the existing session payload structure
        const sessionPayload = {
            userId: user._id.toString(),
            email: user.email,
            name: user.name,
            role: 'user', // Basic role, permissions handle the rest
            planId: user.planId?.toString(),
            projectLimit: 0, // Will be fetched from plan
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiration
        };

        const { createSessionToken } = await import('@/lib/auth');
        const token = await createSessionToken(sessionPayload);

        // Set the session cookie
        const cookieStore = await cookies();
        cookieStore.set('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 // 7 days
        });

        // Redirect is handled on client side usually, but we can return success
        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateUserPermissions(userId: string, permissions: any): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: "Permission denied." };

    if (!userId || !ObjectId.isValid(userId)) return { success: false, error: "Invalid user ID." };

    try {
        const { db } = await connectToDatabase();

        // Ensure permissions object is clean (maybe validate with a schema in a real app)
        // For now we trust the admin input but ensure it's stored as customPermissions

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { customPermissions: permissions } }
        );

        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updatePlanPermissions(planId: string, permissions: any): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: "Permission denied." };

    if (!planId || !ObjectId.isValid(planId)) return { success: false, error: "Invalid plan ID." };

    try {
        const { db } = await connectToDatabase();

        await db.collection('plans').updateOne(
            { _id: new ObjectId(planId) },
            { $set: { permissions: permissions } }
        );

        revalidatePath('/admin/dashboard/plans');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
