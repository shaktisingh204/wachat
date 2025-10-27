
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminSessionToken, verifyAdminJwt } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { headers } from 'next/headers';

export async function getAdminSession(): Promise<{ isAdmin: boolean }> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('admin_session')?.value;
    
    if (!sessionCookie) {
        return { isAdmin: false };
    }

    const payload = await verifyAdminJwt(sessionCookie);
    if (payload && payload.role === 'admin') {
        return { isAdmin: true };
    }

    return { isAdmin: false };
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

        const [
            totalUsers,
            totalWabas,
            totalMessages,
            totalCampaigns,
            totalFlows
        ] = await Promise.all([
            db.collection('users').countDocuments(),
            db.collection('projects').countDocuments({ wabaId: { $exists: true, $ne: null } }),
            db.collection('outgoing_messages').countDocuments(),
            db.collection('broadcasts').countDocuments(),
            db.collection('flow_logs').countDocuments(),
        ]);
        
        return { totalUsers, totalWabas, totalMessages, totalCampaigns, totalFlows };

    } catch (error) {
        console.error("Failed to fetch admin dashboard stats:", error);
        return { totalUsers: 0, totalWabas: 0, totalMessages: 0, totalCampaigns: 0, totalFlows: 0 };
    }
}


export async function handleAdminLogin(prevState: any, formData: FormData): Promise<{ error?: string }> {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || '127.0.0.1';

    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`admin:${ip}`, 5, 60 * 1000); // 5 requests per minute
    if (!rateLimitSuccess) {
        return { error: rateLimitError };
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@wachat.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const adminSessionToken = await createAdminSessionToken();
        const cookieStore = await cookies();
        cookieStore.set('admin_session', adminSessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
        redirect('/admin/dashboard');
    }

    return { error: 'Invalid admin credentials.' };
}

export async function updateProjectCreditsByAdmin(projectId: string, credits: number): Promise<{ success: boolean, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };

    if (!ObjectId.isValid(projectId) || isNaN(credits) || credits < 0) {
        return { success: false, error: 'Invalid project ID or credit amount.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { credits: credits } }
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Project not found.' };
        }
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to update project credits:", error);
        return { success: false, error: 'An unexpected database error occurred.' };
    }
}

export async function updateProjectMpsByAdmin(projectId: string, mps: number): Promise<{ success: boolean, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };

    if (!ObjectId.isValid(projectId) || isNaN(mps) || mps < 1) {
        return { success: false, error: 'Invalid project ID or messages-per-second amount.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { messagesPerSecond: mps } }
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Project not found.' };
        }
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to update project MPS:", error);
        return { success: false, error: 'An unexpected database error occurred.' };
    }
}

export async function updateProjectPlanByAdmin(projectId: string, planId: string): Promise<{ success: boolean, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(planId)) {
        return { success: false, error: 'Invalid project or plan ID.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { planId: new ObjectId(planId) } }
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Project not found.' };
        }
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to update project plan:", error);
        return { success: false, error: 'An unexpected database error occurred.' };
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
        const projectObjectId = new ObjectId(projectId);
        
        const broadcastIds = await db.collection('broadcasts').find({ projectId: projectObjectId }).map(b => b._id).toArray();
        
        const deletePromises = [
            db.collection('projects').deleteOne({ _id: projectObjectId }),
            db.collection('templates').deleteMany({ projectId: projectObjectId }),
            db.collection('broadcasts').deleteMany({ projectId: projectObjectId }),
            db.collection('broadcast_contacts').deleteMany({ broadcastId: { $in: broadcastIds } }),
            db.collection('notifications').deleteMany({ projectId: projectObjectId }),
            db.collection('contacts').deleteMany({ projectId: projectObjectId }),
            db.collection('incoming_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('outgoing_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('flows').deleteMany({ projectId: projectObjectId }),
            db.collection('canned_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('flow_logs').deleteMany({ projectId: projectObjectId }),
            db.collection('meta_flows').deleteMany({ projectId: projectObjectId }),
            db.collection('ad_campaigns').deleteMany({ projectId: projectObjectId }),
            db.collection('ecomm_flows').deleteMany({ projectId: projectObjectId }),
        ];

        await Promise.all(deletePromises);
        
        revalidatePath('/admin/dashboard');

        return { message: 'Project and all associated data have been permanently deleted.' };

    } catch (e: any) {
        console.error('Failed to delete project:', e);
        return { error: e.message || 'An unexpected error occurred while deleting the project.' };
    }
}


export async function getWebhookProcessingStatus(): Promise<{ enabled: boolean }> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('system_settings').findOne({ _id: 'webhook_processing' });
        // Default to enabled if the setting doesn't exist
        return { enabled: setting ? setting.enabled : true };
    } catch (error) {
        console.error("Failed to get webhook status:", error);
        return { enabled: true }; // Fail-safe to enabled
    }
}

export async function setWebhookProcessingStatus(enabled: boolean): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('system_settings').updateOne(
            { _id: 'webhook_processing' },
            { $set: { enabled } },
            { upsert: true }
        );
        return { success: true };
    } catch (error) {
        console.error("Failed to set webhook status:", error);
        return { success: false, error: 'Database error occurred.' };
    }
}

export async function getDiwaliThemeStatus(): Promise<{ enabled: boolean }> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('system_settings').findOne({ _id: 'diwali_theme' });
        return { enabled: setting ? setting.enabled : false };
    } catch (error) {
        console.error("Failed to get Diwali theme status:", error);
        return { enabled: false };
    }
}

export async function setDiwaliThemeStatus(enabled: boolean): Promise<{ success: boolean; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('system_settings').updateOne(
            { _id: 'diwali_theme' },
            { $set: { enabled } },
            { upsert: true }
        );
        return { success: true };
    } catch (error) {
        console.error("Failed to set Diwali theme status:", error);
        return { success: false, error: 'Database error occurred.' };
    }
}
