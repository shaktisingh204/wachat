
'use server';

import { createAdminSessionToken, verifyAdminJwt } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function handleAdminLogin(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; token?: string }> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const token = await createAdminSessionToken();
        return { success: true, token };
    } else {
        return { success: false, error: 'Invalid credentials provided.' };
    }
}

export async function getAdminSession() {
    const cookieStore = await cookies(); // Correctly await the cookies() call
    const token = cookieStore.get('admin_session')?.value;
    if (!token) return { isAdmin: false };

    const payload = await verifyAdminJwt(token);
    if (!payload) return { isAdmin: false };
    
    return { isAdmin: true, payload };
}

export async function getDiwaliThemeStatus(): Promise<{ enabled: boolean }> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ _id: 'diwali_theme' });
        return { enabled: setting?.enabled || false };
    } catch (e) {
        return { enabled: false };
    }
}

export async function setDiwaliThemeStatus(enabled: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { _id: 'diwali_theme' },
            { $set: { enabled } },
            { upsert: true }
        );
        revalidatePath('/admin/dashboard/system', 'page');
        revalidatePath('/dashboard', 'layout');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function setAppLogo(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const logoFile = formData.get('logoFile') as File;
    const logoUrl = formData.get('logoUrl') as string;

    let finalLogoUrl = '';

    if (logoFile && logoFile.size > 0) {
        // In a real app, you would upload this to a storage bucket (e.g., S3, Firebase Storage)
        // and get a public URL. For this prototype, we'll simulate it.
        // This will NOT work in production as the file system is ephemeral.
        finalLogoUrl = 'https://assets.sabnode.com/images/sabnode-logo-light.svg';
        console.log(`Simulating upload for ${logoFile.name}`);
    } else if (logoUrl) {
        finalLogoUrl = logoUrl;
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { _id: 'app_logo' },
            { $set: { url: finalLogoUrl } },
            { upsert: true }
        );
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getAppLogoUrl(): Promise<string | null> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ _id: 'app_logo' });
        return setting?.url || null;
    } catch (e) {
        console.error("Failed to get app logo URL:", e);
        return null;
    }
}


export async function getWebhookProcessingStatus(): Promise<{ enabled: boolean }> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ _id: 'webhook_processing' });
        // Default to true if not set
        return { enabled: setting?.enabled !== false };
    } catch (e) {
        return { enabled: true };
    }
}

export async function setWebhookProcessingStatus(enabled: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { _id: 'webhook_processing' },
            { $set: { enabled } },
            { upsert: true }
        );
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function handleDeleteProjectByAdmin(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };
    
    const projectId = formData.get('projectId') as string;
    
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        await db.collection('projects').deleteOne({ _id: new ObjectId(projectId) });
        // Add more deletion logic here if needed (e.g., associated data)
        
        revalidatePath('/admin/dashboard');
        return { message: 'Project has been successfully deleted.' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateProjectPlanByAdmin(projectId: string, planId: string): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(planId)) {
        return { success: false, error: 'Invalid ID provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { planId: new ObjectId(planId) } }
        );
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProjectCreditsByAdmin(projectId: string, newCredits: number): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };

    if (!ObjectId.isValid(projectId) || isNaN(newCredits)) {
        return { success: false, error: 'Invalid data provided.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { credits: newCredits } }
        );
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProjectMpsByAdmin(projectId: string, newMps: number): Promise<{ success: boolean; error?: string }> {
     const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };

    if (!ObjectId.isValid(projectId) || isNaN(newMps) || newMps < 1) {
        return { success: false, error: 'Invalid data provided.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { messagesPerSecond: newMps } }
        );
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getAdminDashboardStats(): Promise<{
    totalUsers: number;
    totalWabas: number;
    totalMessages: number;
    totalCampaigns: number;
    totalFlows: number;
}> {
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
    } catch(e) {
        return { totalUsers: 0, totalWabas: 0, totalMessages: 0, totalCampaigns: 0, totalFlows: 0 };
    }
}
