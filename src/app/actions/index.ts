

'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId, WithId, Filter } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';
import { translateText } from '@/ai/flows/translate-text';
import { processSingleWebhook, handleSingleMessageEvent, processStatusUpdateBatch, processIncomingMessageBatch } from '@/lib/webhook-processor';
import { processBroadcastJob } from '@/lib/cron-scheduler';
import { intelligentTranslate } from '@/ai/flows/intelligent-translate-flow';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, comparePassword, createSessionToken, verifySessionToken, createAdminSessionToken, verifyAdminSessionToken, type SessionPayload, type AdminSessionPayload } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { premadeTemplates } from '@/lib/premade-templates';
import { getMetaFlows } from './actions/meta-flow.actions';
import { getErrorMessage } from '@/lib/utils';
// Re-exports for server actions are handled by direct imports in components now.
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limiter';
import { decodeJwt } from 'jose';


import type {
    Plan,
    User,
    Invitation,
    Transaction,
    BroadcastAttempt,
    Notification,
    NotificationWithProject,
    Contact,
    AnyMessage,
    LibraryTemplate,
    TemplateCategory,
    CannedMessage,
    FlowLogEntry,
    FlowLog,
    PaymentGatewaySettings,
    WebhookLogListItem,
    Project, 
    Template, 
    PhoneNumber, 
    AutoReplySettings, 
    Flow, 
    FlowNode, 
    FlowEdge, 
    OptInOutSettings, 
    UserAttribute, 
    Agent, 
    MetaFlow, 
    Tag,
    WebhookLog,
    MetaPhoneNumber,
    MetaPhoneNumbersResponse,
    MetaTemplate,
    MetaTemplatesResponse,
    MetaWaba,
    MetaWabasResponse,
    BroadcastJob,
    BroadcastState,
    CreateTemplateState,
    UpdateProjectSettingsState,
    InitiatePaymentResult,
    AdminUserView,
    KanbanColumnData,
    ProjectGroup
} from '@/lib/definitions';


export async function getSession(): Promise<{ user: Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null, tags?: Tag[] } } | null> {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session');
    const sessionToken = sessionCookie?.value;

    if (!sessionToken) {
        return null;
    }

    const payload = await verifySessionToken(sessionToken);
    if (!payload) {
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne(
            { _id: new ObjectId(payload.userId) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return null;
        }

        return { user: JSON.parse(JSON.stringify(user)) };
    } catch (error) {
        console.error("Error fetching session user from DB:", error);
        return null;
    }
}

export async function getAdminSession(): Promise<{ isAdmin: boolean }> {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('admin_session');
    const sessionToken = sessionCookie?.value;
    
    if (!sessionToken) {
        return { isAdmin: false };
    }

    const payload = await verifyAdminSessionToken(sessionToken);
    if (payload && payload.role === 'admin') {
        return { isAdmin: true };
    }

    return { isAdmin: false };
}


export async function handleSuggestContent(topic: string): Promise<{ suggestions?: string[]; error?: string }> {
  if (!topic) {
    const error = 'Topic cannot be empty.';
    return { error };
  }

  try {
    const result = await suggestTemplateContent({ topic });
    return { suggestions: result.suggestions };
  } catch (e: any) {
    return { error: e.message || 'Failed to generate suggestions. Please try again.' };
  }
}

export async function getProjects(query?: string, moduleType: 'whatsapp' | 'facebook' | 'all' = 'all'): Promise<WithId<Project>[]> {
    const session = await getSession();
    if (!session?.user) {
        return [];
    }
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Filter<Project> = {
            $or: [
                { userId: userObjectId },
                { 'agents.userId': userObjectId }
            ]
        };
        
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        if (moduleType === 'whatsapp') {
            filter.wabaId = { $exists: true, $ne: null };
        } else if (moduleType === 'facebook') {
            filter.facebookPageId = { $exists: true, $ne: null };
            filter.wabaId = { $exists: false }; // a project with both is a whatsapp project
        }
        
        const projects = await db.collection('projects').aggregate([
            { $match: filter },
            { $sort: { name: 1 } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            {
                $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true }
            },
            {
                $addFields: {
                    plan: '$planInfo'
                }
            },
            {
                $project: {
                    planInfo: 0
                }
            }
        ]).toArray();

        return JSON.parse(JSON.stringify(projects));
    } catch (error) {
        console.error("Failed to fetch projects for user:", error);
        return [];
    }
}

export async function getProjectCount(): Promise<number> {
    const session = await getSession();
    if (!session?.user) {
        return 0;
    }
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Filter<Project> = {
            $or: [
                { userId: userObjectId },
                { 'agents.userId': userObjectId }
            ]
        };
        
        const count = await db.collection('projects').countDocuments(filter);
        return count;
    } catch (error) {
        console.error("Failed to fetch project count for user:", error);
        return 0;
    }
}

export async function getAllProjectsForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ projects: WithId<Project>[], total: number }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { projects: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = {};
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { wabaId: { $regex: query, $options: 'i' } },
            ];
        }

        const sanePage = Math.max(1, page);
        const skip = (sanePage - 1) * limit;

        const [projects, total] = await Promise.all([
            db.collection('projects').aggregate([
                { $match: filter },
                { $sort: { name: 1 } },
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
                {
                    $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true }
                },
                {
                    $addFields: {
                        plan: '$planInfo'
                    }
                },
                {
                    $project: {
                        planInfo: 0
                    }
                }
            ]).toArray(),
            db.collection('projects').countDocuments(filter)
        ]);
        
        return { projects: JSON.parse(JSON.stringify(projects)), total };
    } catch (error) {
        console.error("Failed to fetch all projects for admin:", error);
        return { projects: [], total: 0 };
    }
}


export async function getProjectById(projectId: string): Promise<WithId<Project> | null> {
    const session = await getSession();
    const { isAdmin } = await getAdminSession();

    if (!session?.user && !isAdmin) {
        return null;
    }
    try {
        if (!ObjectId.isValid(projectId)) {
            console.error("Invalid Project ID in getProjectById:", projectId);
            return null;
        }
        const { db } = await connectToDatabase();
        
        const projectResult = await db.collection<Project>('projects').aggregate([
            { $match: { _id: new ObjectId(projectId) } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            {
                $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true }
            },
            {
                $addFields: {
                    plan: '$planInfo'
                }
            },
            {
                $project: {
                    planInfo: 0
                }
            }
        ]).toArray();

        const project = projectResult[0] as WithId<Project> | undefined;

        if (!project) {
            return null;
        }
        
        if (isAdmin) {
            return JSON.parse(JSON.stringify(project));
        }

        if (session?.user) {
            const isOwner = project.userId.toString() === session.user._id.toString();
            const isAgent = project.agents?.some(agent => agent.userId.toString() === session.user._id.toString());

            if (isOwner || isAgent) {
                return JSON.parse(JSON.stringify(project));
            }
        }
        
        console.error(`User does not have permission to access project ${projectId}.`);
        return null;

    } catch (error: any) {
        console.error("Exception in getProjectById:", error);
        return null;
    }
}

export async function getAllBroadcasts(
    page: number = 1,
    limit: number = 20,
): Promise<{ broadcasts: WithId<any>[], total: number }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { broadcasts: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;

        const [broadcasts, total] = await Promise.all([
            db.collection('broadcasts').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('broadcasts').countDocuments({})
        ]);
        
        return { broadcasts: JSON.parse(JSON.stringify(broadcasts)), total };
    } catch (error) {
        console.error('Failed to fetch all broadcasts:', error);
        return { broadcasts: [], total: 0 };
    }
}

export async function getDashboardStats(projectId: string): Promise<{
    totalMessages: number;
    totalSent: number;
    totalFailed: number;
    totalDelivered: number;
    totalRead: number;
    totalCampaigns: number;
} | null> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return null;

    const defaultStats = { totalMessages: 0, totalSent: 0, totalFailed: 0, totalDelivered: 0, totalRead: 0, totalCampaigns: 0 };
    if (!ObjectId.isValid(projectId)) {
        return defaultStats;
    }
    try {
        const { db } = await connectToDatabase();
        const stats = await db.collection('broadcasts').aggregate([
            { $match: { projectId: new ObjectId(projectId) } },
            {
                $group: {
                    _id: null,
                    totalMessages: { $sum: '$contactCount' },
                    totalSent: { $sum: '$successCount' },
                    totalFailed: { $sum: '$errorCount' },
                    totalDelivered: { $sum: { $ifNull: [ '$deliveredCount', 0 ] } },
                    totalRead: { $sum: { $ifNull: [ '$readCount', 0 ] } },
                    totalCampaigns: { $sum: 1 }
                }
            }
        ]).toArray();

        if (stats.length > 0) {
            const { _id, ...rest } = stats[0];
            return {
                totalMessages: rest.totalMessages || 0,
                totalSent: rest.totalSent || 0,
                totalFailed: rest.totalFailed || 0,
                totalDelivered: rest.totalDelivered || 0,
                totalRead: rest.totalRead || 0,
                totalCampaigns: rest.totalCampaigns || 0,
            };
        }
        return defaultStats;
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return defaultStats;
    }
}

export async function handleTranslateMessage(text: string): Promise<{ translatedText?: string; error?: string }> {
    if (!text) return { error: 'No text to translate.' };
    try {
        const result = await intelligentTranslate({ text, targetLanguage: 'English' });
        return { translatedText: result.translatedText };
    } catch (e: any) {
        return { error: e.message || 'Translation failed.' };
    }
}

export async function handleRunCron(): Promise<{ message?: string; error?: string }> {
    try {
        const result = await processBroadcastJob();
        if (result.jobs && result.jobs.length > 0) {
            const successCount = result.jobs.reduce((acc, j) => acc + (j.success || 0), 0);
            const failedCount = result.jobs.reduce((acc, j) => acc + (j.failed || 0), 0);
            return { message: `Cron run complete. Processed ${result.jobs.length} job(s). ${successCount} successful, ${failedCount} failed.` };
        }
        return { message: result.message || 'Cron run completed successfully. No new jobs to process.' };
    } catch (e: any) {
        console.error('Manual cron run failed:', e);
        return { error: e.message || 'An unexpected error occurred while running the scheduler.' };
    }
}

export async function handleLogin(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || '127.0.0.1';

    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(ip, 5, 60 * 1000); // 5 requests per minute
    if (!rateLimitSuccess) {
        return { error: rateLimitError };
    }
    
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Email and password are required.' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { error: 'Please enter a valid email address.' };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ email: email.toLowerCase() });

        if (!user || !user.password) {
            return { error: 'Invalid credentials.' };
        }

        const passwordMatch = await comparePassword(password, user.password);
        if (!passwordMatch) {
            return { error: 'Invalid credentials.' };
        }

        const sessionToken = await createSessionToken({ userId: user._id.toString(), email: user.email });
        cookies().set('session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    } catch (e: any) {
        console.error('Login failed:', e);
        return { error: 'An unexpected error occurred.' };
    }
    
    redirect('/dashboard');
}

export async function handleAdminLogin(prevState: any, formData: FormData): Promise<{ error?: string }> {
    const headersList = headers();
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
        cookies().set('admin_session', adminSessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
        redirect('/admin/dashboard');
    }

    return { error: 'Invalid admin credentials.' };
}

export async function handleSignup(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!name || !email || !password) {
        return { error: 'All fields are required.' };
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
        return { error: 'Name cannot be empty.' };
    }
    if (trimmedName.length > 50) {
        return { error: 'Name cannot exceed 50 characters.' };
    }
    if (!/[a-zA-Z]/.test(trimmedName)) {
        return { error: 'Name must contain at least one letter.' };
    }

    if (password.length < 6) {
        return { error: 'Password must be at least 6 characters long.' };
    }

    try {
        const { db } = await connectToDatabase();
        const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return { error: 'An account with this email already exists.' };
        }

        const hashedPassword = await hashPassword(password);
        
        const newUser: Omit<User, '_id'> = {
            name: trimmedName,
            email: email.toLowerCase(),
            password: hashedPassword,
            createdAt: new Date(),
        };

        await db.collection('users').insertOne(newUser as any);
    } catch (e: any) {
        console.error('Signup failed:', e);
        return { error: 'An unexpected error occurred.' };
    }

    redirect('/login');
}

export async function handleForgotPassword(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const email = formData.get('email') as string;
    if (!email) return { error: 'Email address is required.' };
    
    // In a real app, you would generate a unique token, save it to the DB with an expiry,
    // and send an email with a reset link.
    // For this prototype, we'll just simulate success.
    console.log(`Password reset requested for: ${email}`);
    
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
}


export async function handleUpdateUserProfile(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const name = formData.get('name') as string;
    const tagsJson = formData.get('tags') as string;

    const updates: any = {};
    if (name) {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return { error: 'Name cannot be empty.' };
        }
        if (trimmedName.length > 50) {
            return { error: 'Name cannot exceed 50 characters.' };
        }
        if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
             return { error: 'Name can only contain letters, spaces, apostrophes, and hyphens.' };
        }
         if (!/[a-zA-Z]/.test(trimmedName)) {
            return { error: 'Name must contain at least one letter.' };
        }
        updates.name = trimmedName;
    }
    
    if (tagsJson) {
      try {
        updates.tags = JSON.parse(tagsJson);
      } catch (e) {
        return { error: 'Invalid tags format.'};
      }
    }

    if (Object.keys(updates).length === 0) return { error: 'No changes detected.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: updates }
        );
        revalidatePath('/dashboard/profile');
        revalidatePath('/dashboard/url-shortener');
        revalidatePath('/dashboard/settings');
        return { message: 'Profile updated successfully.' };
    } catch (e: any) {
        return { error: 'Failed to update profile.' };
    }
}

export async function handleChangePassword(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return { error: 'All password fields are required.' };
    }
    if (newPassword !== confirmPassword) {
        return { error: 'New passwords do not match.' };
    }
    if (newPassword.length < 6) {
        return { error: 'New password must be at least 6 characters long.' };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        if (!user || !user.password) return { error: 'User not found or password not set.' };

        const passwordMatch = await comparePassword(currentPassword, user.password);
        if (!passwordMatch) return { error: 'Incorrect current password.' };

        const hashedNewPassword = await hashPassword(newPassword);
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { password: hashedNewPassword } }
        );

        revalidatePath('/dashboard/profile');
        return { message: 'Password updated successfully.' };
    } catch (e: any) {
        return { error: 'Failed to update password.' };
    }
}

export async function handleFacebookSetup(accessToken: string, wabaIds: string[], includeCatalog: boolean): Promise<{ success: boolean, count: number, error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, count: 0, error: 'You must be logged in.' };
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) {
        return { success: false, count: 0, error: 'Platform App ID is not configured.' };
    }

    try {
        const { db } = await connectToDatabase();
        const bulkOps: any[] = [];
        const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });

        let businessId: string | undefined = undefined;
        if (includeCatalog) {
            try {
                const businessesResponse = await axios.get(`https://graph.facebook.com/v23.0/me/businesses`, {
                    params: { access_token: accessToken }
                });
                const businesses = businessesResponse.data?.data;
                if (businesses && businesses.length > 0) {
                    businessId = businesses[0].id;
                } else {
                    console.warn("No Meta Business account found for token, cannot enable catalog management.");
                }
            } catch(e) {
                console.warn("Failed to fetch business ID during guided setup:", getErrorMessage(e));
            }
        }

        for (const wabaId of wabaIds) {
            const wabaDetailsResponse = await fetch(`https://graph.facebook.com/v23.0/${wabaId}?fields=name,id&access_token=${accessToken}`);
            const wabaData = await wabaDetailsResponse.json();

            if (wabaData.error) {
                console.error(`Failed to fetch details for WABA ${wabaId}:`, wabaData.error);
                continue;
            }

            const projectDoc = {
                userId: new ObjectId(session.user._id),
                name: wabaData.name,
                wabaId: wabaData.id,
                accessToken: accessToken,
                appId: appId,
                createdAt: new Date(),
                messagesPerSecond: 10000,
                planId: defaultPlan?._id,
                credits: defaultPlan?.signupCredits || 0,
                businessId: businessId,
                hasCatalogManagement: includeCatalog,
            };

            bulkOps.push({
                updateOne: {
                    filter: { wabaId: wabaData.id },
                    update: { 
                        $set: { 
                            name: projectDoc.name, 
                            accessToken: projectDoc.accessToken, 
                            userId: projectDoc.userId,
                            appId: projectDoc.appId,
                            businessId: projectDoc.businessId,
                            hasCatalogManagement: projectDoc.hasCatalogManagement,
                        },
                        $setOnInsert: { ...projectDoc, phoneNumbers: [] }
                    },
                    upsert: true,
                }
            });
        }
        
        if (bulkOps.length > 0) {
            const result = await db.collection('projects').bulkWrite(bulkOps);
            const syncedCount = result.upsertedCount + result.modifiedCount;

            const syncedProjects = await db.collection<WithId<Project>>('projects').find({ wabaId: { $in: wabaIds }, userId: new ObjectId(session.user._id) }).project({ _id: 1, wabaId: 1, appId: 1, accessToken: 1 }).toArray();
            for (const project of syncedProjects) {
                 await handleSubscribeProjectWebhook(project.wabaId!, project.appId!, project.accessToken);
            }

            revalidatePath('/dashboard');
            return { success: true, count: syncedCount };
        } else {
            return { success: false, count: 0, error: "No valid WABAs could be processed." };
        }

    } catch (e: any) {
        console.error("Facebook setup failed:", e);
        return { success: false, count: 0, error: e.message || 'An unexpected error occurred during setup.' };
    }
}
    
export async function getPublicProjectById(projectId: string): Promise<WithId<Project> | null> {
    try {
        if (!ObjectId.isValid(projectId)) {
            return null;
        }
        const { db } = await connectToDatabase();
        const project = await db.collection<Project>('projects').findOne({ _id: new ObjectId(projectId) });
        return project ? JSON.parse(JSON.stringify(project)) : null;
    } catch (error: any) {
        return null;
    }
}


export async function handleSyncWabas(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }

    const accessToken = formData.get('accessToken') as string;
    const appId = formData.get('appId') as string;
    const businessId = formData.get('businessId') as string;
    const groupName = formData.get('groupName') as string | undefined;

    if (!accessToken || !appId || !businessId) {
        return { error: 'Access Token, App ID, and Business ID are required.' };
    }
    
    const apiVersion = 'v23.0';
    
    try {
        const { db } = await connectToDatabase();
        
        let groupId: ObjectId | undefined;
        if (groupName) {
            const groupResult = await db.collection<ProjectGroup>('project_groups').insertOne({
                userId: new ObjectId(session.user._id),
                name: groupName,
                createdAt: new Date(),
            });
            groupId = groupResult.insertedId;
        }

        // Get all WABAs for that business
        let allWabas: MetaWaba[] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/${apiVersion}/${businessId}/client_whatsapp_business_accounts?access_token=${accessToken}&limit=100`;
        console.log(nextUrl);
        while(nextUrl) {
            const response = await fetch(nextUrl);
            const responseData: MetaWabasResponse = await response.json();

            if (!response.ok) {
                 const errorMessage = (responseData as any)?.error?.message || 'Unknown error syncing WABAs.';
                 console.log(errorMessage);
                 return { error: `API Error: ${errorMessage}` };
            }
            
            if (responseData.data && responseData.data.length > 0) {
                allWabas.push(...responseData.data);
            }
            
            nextUrl = responseData.paging?.next;
        }

        if (allWabas.length === 0) {
            return { message: 'No client WhatsApp Business Accounts found to sync.' };
        }
        
        const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });

        // Prepare bulk operations with ownership transfer
        const bulkOps = await Promise.all(allWabas.map(async (waba) => {
            const phoneNumbersResponse = await fetch(
                `https://graph.facebook.com/${apiVersion}/${waba.id}/phone_numbers?access_token=${accessToken}&fields=verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput`
            );
            const phoneNumbersData: MetaPhoneNumbersResponse = await phoneNumbersResponse.json();
            
            const phoneNumbers: PhoneNumber[] = phoneNumbersData.data ? phoneNumbersData.data.map((num: any) => ({
                id: num.id,
                display_phone_number: num.display_phone_number,
                verified_name: num.verified_name,
                code_verification_status: num.code_verification_status,
                quality_rating: num.quality_rating,
                platform_type: num.platform_type,
                throughput: num.throughput,
            })) : [];

            const projectDoc = {
                userId: new ObjectId(session.user._id),
                name: waba.name,
                accessToken: accessToken,
                appId: appId,
                phoneNumbers: phoneNumbers,
                businessId: businessId,
                hasCatalogManagement: true,
                ...(groupId && { groupId }),
                ...(groupName && { groupName }),
            };

            return {
                updateOne: {
                    filter: { wabaId: waba.id },
                    update: { 
                        $set: projectDoc,
                        $setOnInsert: {
                             wabaId: waba.id,
                             createdAt: new Date(),
                             messagesPerSecond: 80,
                             planId: defaultPlan?._id,
                             credits: defaultPlan?.signupCredits || 0,
                        }
                    },
                    upsert: true,
                }
            };
        }));
        
        if (bulkOps.length > 0) {
            const result = await db.collection('projects').bulkWrite(bulkOps);
            const syncedCount = result.upsertedCount + result.modifiedCount;
            revalidatePath('/dashboard');
            return { message: `Successfully synced ${syncedCount} project(s) and assigned them to you.` };
        } else {
            return { message: "No new projects to sync." };
        }

    } catch (e: any) {
        console.error('Project sync from Meta failed:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred during project sync.' };
    }
}
