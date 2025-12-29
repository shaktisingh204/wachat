
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminJwt, createAdminSessionToken } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { handleSyncPhoneNumbers, handleSubscribeProjectWebhook } from '@/app/actions/whatsapp.actions';
import type { WithId, Project, User } from '@/lib/definitions';
import { ObjectId } from 'mongodb';


export async function getAdminSession() {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_session')?.value;
    if (!token) return { isAdmin: false };

    const payload = await verifyAdminJwt(token);
    return { isAdmin: !!payload };
}

export async function handleAdminLogin(prevState: any, formData: FormData): Promise<{ success: boolean; token?: string; error?: string }> {
    const email = formData.get('email');
    const password = formData.get('password');

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const token = await createAdminSessionToken();
        // Return the token to the client to set the cookie
        return { success: true, token };
    }

    return { success: false, error: 'Invalid email or password.' };
}


export async function handleDeleteProjectByAdmin(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) {
        return { error: 'Permission denied.' };
    }
    
    const projectId = formData.get('projectId') as string;
    
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        await db.collection('projects').deleteOne({ _id: new ObjectId(projectId) });
        
        return { message: 'Project has been successfully deleted.' };

    } catch (e: any) {
        console.error('Failed to delete project:', e);
        return { error: e.message || 'An unexpected error occurred while deleting the project.' };
    }
}

export async function getAdminDashboardStats(): Promise<{ totalUsers: number, totalWabas: number, totalMessages: number, totalCampaigns: number, totalFlows: number }> {
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

export async function updateProjectCreditsByAdmin(projectId: string, credits: number): Promise<{ success: boolean, error?: string }> {
     const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    if (!ObjectId.isValid(projectId)) return { success: false, error: 'Invalid project ID.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne({ _id: new ObjectId(projectId) }, { $set: { credits } });
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProjectMpsByAdmin(projectId: string, mps: number): Promise<{ success: boolean, error?: string }> {
     const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    if (!ObjectId.isValid(projectId)) return { success: false, error: 'Invalid project ID.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne({ _id: new ObjectId(projectId) }, { $set: { messagesPerSecond: mps } });
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateProjectPlanByAdmin(projectId: string, planId: string): Promise<{ success: boolean, error?: string }> {
     const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(planId)) {
        return { success: false, error: 'Invalid ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne({ _id: new ObjectId(projectId) }, { $set: { planId: new ObjectId(planId) } });
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function handleSubscribeAllProjects() {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };
    try {
        const { db } = await connectToDatabase();
        const projects = await db.collection<WithId<Project>>('projects').find({ wabaId: { $exists: true, $ne: null } }).toArray();
        
        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        for(const project of projects) {
            try {
                if (project.wabaId && project.accessToken && project.appId) {
                    await handleSubscribeProjectWebhook(project.wabaId, project.appId, project.accessToken);
                    successCount++;
                } else {
                    failCount++;
                }
            } catch(e) {
                failCount++;
                errors.push(`${project.name}: ${getErrorMessage(e)}`);
            }
        }
        
        return { message: `Subscribed ${successCount} projects. Failed on ${failCount}.` };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getDiwaliThemeStatus(): Promise<{ enabled: boolean }> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ _id: 'diwaliTheme' });
        return { enabled: !!setting?.enabled };
    } catch {
        return { enabled: false };
    }
}

export async function setDiwaliThemeStatus(enabled: boolean): Promise<{ success: boolean }> {
    try {
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { _id: 'diwaliTheme' },
            { $set: { enabled } },
            { upsert: true }
        );
        return { success: true };
    } catch {
        return { success: false };
    }
}

export async function getWebhookProcessingStatus(): Promise<{ enabled: boolean }> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ _id: 'webhookProcessing' });
        // Default to enabled if not set
        return { enabled: setting?.enabled !== false };
    } catch {
        return { enabled: true };
    }
}

export async function setWebhookProcessingStatus(enabled: boolean): Promise<{ success: boolean }> {
    try {
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { _id: 'webhookProcessing' },
            { $set: { enabled } },
            { upsert: true }
        );
        return { success: true };
    } catch {
        return { success: false };
    }
}

export async function setAppLogo(prevState: any, formData: FormData): Promise<{ success: boolean, error?: string }> {
     const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    
    const logoUrl = formData.get('logoUrl') as string | null;
    const logoFile = formData.get('logoFile') as File | null;
    
    let finalLogoUrl = logoUrl;

    if (logoFile && logoFile.size > 0) {
        // In a real app, you would upload this to S3/GCS and get a public URL.
        // For this demo, we'll convert it to a data URI.
        const buffer = Buffer.from(await logoFile.arrayBuffer());
        finalLogoUrl = `data:${logoFile.type};base64,${buffer.toString('base64')}`;
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { _id: 'appLogo' },
            { $set: { url: finalLogoUrl } },
            { upsert: true }
        );
        return { success: true };
    } catch(e) {
        return { success: false, error: 'Failed to update logo in database.' };
    }
}

export async function getAppLogoUrl(): Promise<string | null> {
     try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ _id: 'appLogo' });
        return setting?.url || null;
    } catch {
        return null;
    }
}

