
'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { SignJWT } from 'jose';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { getErrorMessage } from '@/lib/utils';
import { comparePassword, verifyAdminJwt, createAdminSessionToken } from '@/lib/auth';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { Plan, Project, User } from '@/lib/definitions';
import cache from '@/lib/cache';

const DIWALI_THEME_KEY = 'diwali_theme_enabled';
let isDiwaliThemeEnabled: boolean | null = null;

export async function getAdminSession() {
    const cookieStore = await cookies(); // ✅ MUST await in Next 16
    const token = cookieStore.get("admin_session")?.value;
    if (!token) return { isAdmin: false };

    const payload = await verifyAdminJwt(token);
    if (!payload || payload.role !== 'admin') {
        return { isAdmin: false };
    }

    return { isAdmin: true, user: payload };
}

export async function setWebhookProcessingStatus(enabled: boolean) {
    try {
        cache.set('webhook_processing_enabled', enabled);
        return { success: true };
    } catch(e: any) {
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

export async function handleAdminLogin(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminEmail || !adminPasswordHash || !jwtSecret) {
        const errorMessage = "Server misconfiguration: Admin credentials are not set in the environment variables.";
        return { success: false, error: errorMessage };
    }

    if (email !== adminEmail) {
        return { success: false, error: "Invalid credentials." };
    }

    try {
        const isMatch = await comparePassword(password, adminPasswordHash);

        if (!isMatch) {
            return { success: false, error: "Invalid credentials." };
        }
        
        const token = await createAdminSessionToken();
        
        return { success: true, token };
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

export async function getAdminDashboardStats() {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) {
        return { totalUsers: 0, totalWabas: 0, totalMessages: 0, totalCampaigns: 0, totalFlows: 0 };
    }
    try {
        const { db } = await connectToDatabase();
        const [totalUsers, totalWabas, totalMessages, totalCampaigns, totalFlows] = await Promise.all([
            db.collection('users').countDocuments(),
            db.collection('projects').countDocuments({ wabaId: { $exists: true } }),
            db.collection('outgoing_messages').countDocuments(),
            db.collection('broadcasts').countDocuments(),
            db.collection('flows').countDocuments(),
        ]);
        return { totalUsers, totalWabas, totalMessages, totalCampaigns, totalFlows };
    } catch (e) {
        console.error("Failed to fetch admin stats:", e);
        return { totalUsers: 0, totalWabas: 0, totalMessages: 0, totalCampaigns: 0, totalFlows: 0 };
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
    } catch(e: any) {
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
        isDiwaliThemeEnabled = setting?.value ?? false;
        return { enabled: isDiwaliThemeEnabled };
    } catch (e) {
        return { enabled: false };
    }
}

    

    
