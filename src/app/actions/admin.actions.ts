'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ObjectId, type Filter, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { createAdminSessionToken, verifyAdminJwt, hashPassword, comparePassword } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';
import type { User, Project, Plan, Broadcast } from '@/lib/definitions';


export async function getAdminSession() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;
  if (!sessionToken) {
    return { isAdmin: false };
  }

  const payload = await verifyAdminJwt(sessionToken);
  return { isAdmin: !!payload };
}


export async function handleAdminLogin(prevState: any, formData: FormData): Promise<{ error?: string }> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const token = await createAdminSessionToken();

        cookies().set('admin_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 24 hours
        });
        
        redirect('/admin/dashboard');
    }

    return { error: 'Invalid credentials.' };
}

export async function getAdminDashboardStats(): Promise<{ totalUsers: number, totalWabas: number, totalMessages: number, totalCampaigns: number, totalFlows: number }> {
     const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { totalUsers: 0, totalWabas: 0, totalMessages: 0, totalCampaigns: 0, totalFlows: 0 };
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
        // Optionally, add more cleanup logic for related data
        
        revalidatePath('/admin/dashboard');

        return { message: 'Project has been successfully deleted.' };

    } catch (e: any) {
        console.error('Failed to delete project by admin:', e);
        return { error: e.message || 'An unexpected error occurred while deleting the project.' };
    }
}

export async function updateProjectCreditsByAdmin(projectId: string, credits: number): Promise<{ success: boolean; error?: string }> {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return { success: false, error: 'Permission denied.' };

  if (!ObjectId.isValid(projectId) || isNaN(credits)) {
    return { success: false, error: 'Invalid input.' };
  }

  try {
    const { db } = await connectToDatabase();
    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: { credits: credits } }
    );
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateProjectMpsByAdmin(projectId: string, mps: number): Promise<{ success: boolean; error?: string }> {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return { success: false, error: 'Permission denied.' };

  if (!ObjectId.isValid(projectId) || isNaN(mps) || mps < 1) {
    return { success: false, error: 'Invalid input. MPS must be at least 1.' };
  }

  try {
    const { db } = await connectToDatabase();
    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: { messagesPerSecond: mps } }
    );
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateProjectPlanByAdmin(projectId: string, planId: string): Promise<{ success: boolean; error?: string }> {
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
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function getAllBroadcasts(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ broadcasts: WithId<Broadcast>[], total: number }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { broadcasts: [], total: 0 };
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Broadcast> = {};
        if (query) {
             filter.templateName = { $regex: query, $options: 'i' };
        }
        
        const skip = (page - 1) * limit;
        
        const [broadcasts, total] = await Promise.all([
             db.collection<Broadcast>('broadcasts').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
             db.collection('broadcasts').countDocuments(filter)
        ]);

        return { broadcasts: JSON.parse(JSON.stringify(broadcasts)), total };
    } catch(e) {
        return { broadcasts: [], total: 0 };
    }
}

export async function getDiwaliThemeStatus(): Promise<{ enabled: boolean }> {
  try {
    const { db } = await connectToDatabase();
    const setting = await db.collection('settings').findOne({ _id: 'diwaliTheme' });
    return { enabled: setting?.enabled || false };
  } catch (e) {
    return { enabled: false };
  }
}

export async function setDiwaliThemeStatus(enabled: boolean): Promise<{ success: boolean }> {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return { success: false };
  try {
    const { db } = await connectToDatabase();
    await db.collection('settings').updateOne(
      { _id: 'diwaliTheme' },
      { $set: { enabled } },
      { upsert: true }
    );
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

export async function getWebhookProcessingStatus(): Promise<{ enabled: boolean }> {
  try {
    const { db } = await connectToDatabase();
    const setting = await db.collection('settings').findOne({ _id: 'webhookProcessing' });
    return { enabled: setting?.enabled !== false }; // Default to true if not set
  } catch (e) {
    return { enabled: true };
  }
}

export async function setWebhookProcessingStatus(enabled: boolean): Promise<{ success: boolean }> {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return { success: false };
  try {
    const { db } = await connectToDatabase();
    await db.collection('settings').updateOne(
      { _id: 'webhookProcessing' },
      { $set: { enabled } },
      { upsert: true }
    );
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

export async function setAppLogo(prevState: any, formData: FormData): Promise<{ success: boolean, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };
    
    const logoUrl = formData.get('logoUrl') as string | null;
    const logoFile = formData.get('logoFile') as File | null;
    
    let finalLogoUrl = '';

    if (logoUrl) {
        finalLogoUrl = logoUrl;
    } else if (logoFile && logoFile.size > 0) {
        // In a real app, you would upload this file to a cloud storage (like S3, GCS)
        // and get a public URL. For this demo, we will use a placeholder or convert to data URI.
        // Data URI is not ideal for large images.
        // For now, let's just simulate this.
        finalLogoUrl = "https://assets.sabnode.com/logo-dark.png"; // Placeholder
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('settings').updateOne(
            { _id: 'appLogo' },
            { $set: { url: finalLogoUrl } },
            { upsert: true }
        );
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getAppLogoUrl(): Promise<string | null> {
    try {
        const { db } = await connectToDatabase();
        const setting = await db.collection('settings').findOne({ _id: 'appLogo' });
        return setting?.url || null;
    } catch (e) {
        return null;
    }
}

