
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { createAdminSessionToken, getAdminSession } from '@/lib/auth'; // Corrected import
import type { Plan, Project, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { cookies } from 'next/headers';
import cache from '@/lib/cache';

const DIWALI_THEME_KEY = 'diwali_theme_enabled';
let isDiwaliThemeEnabled: boolean | null = null;


export async function handleAdminLogin(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return { success: false, error: 'Invalid credentials.' };
    }

    const token = await createAdminSessionToken();
    return { success: true, token };
}

export async function getProjectsForAdmin(page: number = 1, limit: number = 5, query?: string) {
    try {
        const { db } = await connectToDatabase();
        const filter: any = {};
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }
        
        const [projects, total] = await Promise.all([
            db.collection('projects').find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
            db.collection('projects').countDocuments(filter)
        ]);

        const projectIds = projects.map(p => p.planId).filter(Boolean);
        const plans = await db.collection('plans').find({ _id: { $in: projectIds } }).toArray();
        const plansMap = new Map(plans.map(p => [p._id.toString(), p]));

        const projectsWithPlans = projects.map(p => ({
            ...p,
            plan: p.planId ? plansMap.get(p.planId.toString()) : null
        }));

        return {
            projects: JSON.parse(JSON.stringify(projectsWithPlans)),
            total,
        };
    } catch (e: any) {
        return { projects: [], total: 0 };
    }
}

export async function getUsersForAdmin(page: number = 1, limit: number = 10, query?: string) {
    try {
        const { db } = await connectToDatabase();
        const filter: any = {};
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            db.collection('users').find(filter).project({ password: 0 }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
            db.collection('users').countDocuments(filter)
        ]);
        
        return {
            users: JSON.parse(JSON.stringify(users)),
            total
        };

    } catch(e: any) {
        return { users: [], total: 0 };
    }
}

export async function getAdminDashboardStats() {
    try {
        const { db } = await connectToDatabase();
        const [totalUsers, totalWabas, totalMessages, totalCampaigns, totalFlows] = await Promise.all([
            db.collection('users').countDocuments(),
            db.collection('projects').countDocuments({ wabaId: { $exists: true, $ne: null } }),
            db.collection('outgoing_messages').countDocuments(),
            db.collection('broadcasts').countDocuments(),
            db.collection('flows').countDocuments(),
        ]);
        return { totalUsers, totalWabas, totalMessages, totalCampaigns, totalFlows };
    } catch (e) {
        return { totalUsers: 0, totalWabas: 0, totalMessages: 0, totalCampaigns: 0, totalFlows: 0 };
    }
}

export async function updateProjectCreditsByAdmin(projectId: string, credits: number) {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { credits: Number(credits) } }
        );
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProjectMpsByAdmin(projectId: string, mps: number) {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { messagesPerSecond: Number(mps) } }
        );
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProjectPlanByAdmin(projectId: string, planId: string) {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    
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
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function handleDeleteProjectByAdmin(prevState: any, formData: FormData) {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };
    
    const projectId = formData.get('projectId') as string;
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid project ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        
        // This is a simplified deletion. In a real scenario, you'd want a transaction
        // and to delete data from all related collections (contacts, messages, broadcasts, etc.)
        await db.collection('projects').deleteOne({ _id: projectObjectId });

        revalidatePath('/admin/dashboard');
        return { message: 'Project deleted successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getDiwaliThemeStatus(): Promise<{ enabled: boolean }> {
  if (isDiwaliThemeEnabled !== null) {
    return { enabled: isDiwaliThemeEnabled };
  }
  try {
    const { db } = await connectToDatabase();
    const setting = await db.collection('app_settings').findOne({ key: DIWALI_THEME_KEY });
    isDiwaliThemeEnabled = !!setting?.value;
    return { enabled: isDiwaliThemeEnabled };
  } catch (e) {
    return { enabled: false };
  }
}

export async function setDiwaliThemeStatus(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return { success: false, error: 'Permission denied.' };

  try {
    const { db } = await connectToDatabase();
    await db.collection('app_settings').updateOne(
      { key: DIWALI_THEME_KEY },
      { $set: { value: enabled } },
      { upsert: true }
    );
    isDiwaliThemeEnabled = enabled; // Update cache
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function setAppLogo(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: "Permission denied." };
    
    try {
        const logoFile = formData.get('logoFile') as File;
        const logoUrl = formData.get('logoUrl') as string;

        let finalUrl = '';

        if (logoFile && logoFile.size > 0) {
            // Upload file to a storage bucket (e.g., S3) and get URL
            // This part is placeholder as we don't have a file upload service
            finalUrl = 'https://assets.sabnode.com/logo.png'; // Placeholder URL
        } else if (logoUrl) {
            finalUrl = logoUrl;
        }

        const { db } = await connectToDatabase();
        await db.collection('app_settings').updateOne(
            { key: 'app_logo_url' },
            { $set: { value: finalUrl } },
            { upsert: true }
        );
        
        cache.del('app_logo_url');

        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getAppLogoUrl(): Promise<string | null> {
    const cachedUrl = cache.get('app_logo_url') as string | undefined;
    if (cachedUrl) return cachedUrl;
    
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('app_settings').findOne({ key: 'app_logo_url' });
        const url = setting?.value as string | null;
        if (url) {
            cache.set('app_logo_url', url, 3600); // Cache for 1 hour
        }
        return url;
    } catch(e) {
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
