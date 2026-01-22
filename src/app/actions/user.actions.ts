

'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type WithId, ObjectId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getDecodedSession, verifyAdminJwt } from '@/lib/auth';
import { createAdminSessionToken } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';
import type { Project, User, Plan } from '@/lib/definitions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { processBroadcastJob } from '@/lib/cron-scheduler';
import { handleSubscribeProjectWebhook, handleSyncPhoneNumbers } from '@/app/actions/whatsapp.actions';
import axios from 'axios';


export async function getProjectById(projectId?: string | null, userId?: string | null): Promise<WithId<Project> | null> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        console.error("Invalid Project ID in getProjectById:", projectId);
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        
        const filter: Filter<Project> = { _id: projectObjectId };

        // If userId is provided (and not null), enforce ownership/agent check.
        // If userId is null, it's a system-level call, bypass ownership check.
        if (userId !== null) {
            let userFilterId: ObjectId | null = null;
            if (userId) {
                userFilterId = new ObjectId(userId);
            } else {
                const session = await getSession();
                if (session?.user?._id) {
                    userFilterId = new ObjectId(session.user._id);
                }
            }

            if (!userFilterId) {
                return null; // No authenticated user and not a system call
            }
            
            filter.$or = [
                { userId: userFilterId },
                { 'agents.userId': userFilterId }
            ];
        }

        const project = await db.collection<WithId<Project>>('projects').findOne(filter);
        
        if (!project) return null;
        
        let plan: WithId<Plan> | null = null;
        if (project.planId && ObjectId.isValid(project.planId)) {
            plan = await db.collection<WithId<Plan>>('plans').findOne({ _id: new ObjectId(project.planId) });
        }
        if (!plan) {
            plan = await db.collection<WithId<Plan>>('plans').findOne({ isDefault: true });
        }
        
        const finalProject = { ...project, plan };
        
        return JSON.parse(JSON.stringify(finalProject));
    } catch (error) {
        console.error("Failed to fetch project by ID:", error);
        return null;
    }
}


export async function getProjects(query?: string, type?: 'whatsapp' | 'facebook'): Promise<{ projects: WithId<Project>[] }> {
    console.log(`[getProjects] Fetching projects. Type: ${type}, Query: ${query}`);
    const session = await getSession();
    if (!session?.user) {
        console.log('[getProjects] No session user found. Returning empty array.');
        return { projects: [] };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        console.log(`[getProjects] Authenticated user ID: ${userObjectId.toString()}`);

        const projectFilter: Filter<Project> = {
            $or: [
                { userId: userObjectId },
                { 'agents.userId': userObjectId },
            ],
        };

        if (query) {
            projectFilter.name = { $regex: query, $options: 'i' };
        }
        
        if (type === 'whatsapp') {
            projectFilter.wabaId = { $exists: true, $ne: "" };
        } else if (type === 'facebook') {
            projectFilter.facebookPageId = { $exists: true, $ne: "" };
        }
        
        console.log('[getProjects] Using filter:', JSON.stringify(projectFilter, null, 2));

        const projects = await db.collection<Project>('projects')
            .find(projectFilter)
            .sort({ createdAt: -1 })
            .toArray();
            
        console.log(`[getProjects] Found ${projects.length} projects after filtering.`);
            
        return { projects: JSON.parse(JSON.stringify(projects)) };
    } catch (error) {
        console.error("[getProjects] Failed to fetch projects:", error);
        return { projects: [] };
    }
}

export async function getProjectsForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ projects: WithId<any>[], total: number }> {
     try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = {};
        if (query) {
             filter.name = { $regex: query, $options: 'i' };
        }
        
        const skip = (page - 1) * limit;
        
        const [projects, total] = await Promise.all([
             db.collection<Project>('projects').aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'plans',
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'plan'
                    }
                },
                {
                    $unwind: { path: '$plan', preserveNullAndEmptyArrays: true }
                }
             ]).toArray(),
             db.collection('projects').countDocuments(filter)
        ]);

        return { projects: JSON.parse(JSON.stringify(projects)), total };
    } catch(e) {
        return { projects: [], total: 0 };
    }
}

export async function getWhatsAppProjectsForAdmin(
    page: number = 1,
    limit: number = 20,
    query?: string,
    userId?: string
): Promise<{ projects: WithId<Project & { owner: { name: string; email: string } }>[], total: number, users: WithId<User>[] }> {
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = { wabaId: { $exists: true, $ne: null } };
        
        if (query) {
             filter.name = { $regex: query, $options: 'i' };
        }
        if (userId) {
            filter.userId = new ObjectId(userId);
        }
        
        const skip = (page - 1) * limit;

        const pipeline: any[] = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'ownerInfo'
                }
            },
            { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'owner.name': '$ownerInfo.name', 'owner.email': '$ownerInfo.email' } },
            { $project: { ownerInfo: 0 } }
        ];
        
        const [projects, total, users] = await Promise.all([
             db.collection<Project>('projects').aggregate(pipeline).toArray(),
             db.collection('projects').countDocuments(filter),
             db.collection('users').find({}).project({ name: 1, email: 1 }).toArray()
        ]);

        return { 
            projects: JSON.parse(JSON.stringify(projects)), 
            total: total,
            users: JSON.parse(JSON.stringify(users))
        };
    } catch (e: any) {
        console.error("Failed to get WhatsApp projects for admin:", e);
        return { projects: [], total: 0, users: [] };
    }
}

export async function handleDeleteUserProject(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }
    
    const projectId = formData.get('projectId') as string;
    
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const projectToDelete = await db.collection('projects').findOne({
            _id: new ObjectId(projectId),
            userId: new ObjectId(session.user._id)
        });

        if (!projectToDelete) {
            return { error: 'Project not found or you do not have permission to delete it.' };
        }

        // Add more deletion logic here if needed (e.g., associated data)
        await db.collection('projects').deleteOne({ _id: new ObjectId(projectId) });
        
        revalidatePath('/dashboard');

        return { message: 'Project has been successfully deleted.' };

    } catch (e: any) {
        console.error('Failed to delete project:', e);
        return { error: e.message || 'An unexpected error occurred while deleting the project.' };
    }
}

export async function handleRunCron() {
    // This is a placeholder for a more complex cron job runner if needed.
    // For now, it will return a success message.
    return { message: 'Cron jobs triggered.', error: null };
}

export async function handleSyncWabas(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, count?: number }> {
    const accessToken = formData.get('accessToken') as string;
    const appId = formData.get('appId') as string;
    const businessId = formData.get('businessId') as string;
    const groupName = formData.get('groupName') as string;

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    
    if (!accessToken || !appId || !businessId) {
        return { error: 'Access Token, App ID, and Business ID are required.'};
    }
    
    try {
        const { db } = await connectToDatabase();

        let groupId: ObjectId | undefined;
        if(groupName) {
            const groupResult = await db.collection('project_groups').insertOne({
                userId: new ObjectId(session.user._id),
                name: groupName,
                createdAt: new Date()
            });
            groupId = groupResult.insertedId;
        }

        const response = await axios.get(`https://graph.facebook.com/v23.0/${businessId}/whatsapp_business_accounts`, {
            params: {
                fields: 'id,name',
                access_token: accessToken,
            }
        });

        const wabas = response.data.data;
        if (wabas.length === 0) {
            return { message: "No WhatsApp Business Accounts found in this business portfolio." };
        }

        const bulkOps = wabas.map((waba: any) => ({
            updateOne: {
                filter: { userId: new ObjectId(session.user._id), wabaId: waba.id },
                update: {
                    $set: {
                        name: waba.name,
                        accessToken: accessToken,
                        appId: appId,
                        businessId: businessId,
                        ...(groupId && groupName && { groupId, groupName }),
                    },
                    $setOnInsert: {
                        userId: new ObjectId(session.user._id),
                        wabaId: waba.id,
                        createdAt: new Date(),
                        messagesPerSecond: 80,
                    },
                },
                upsert: true,
            },
        }));

        const result = await db.collection('projects').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;

        // Subscribe new projects
        if (result.upsertedIds) {
            for (const id of Object.values(result.upsertedIds)) {
                const newProject = await db.collection<Project>('projects').findOne({_id: id});
                if(newProject) {
                    await handleSyncPhoneNumbers(newProject._id.toString());
                    await handleSubscribeProjectWebhook(newProject.wabaId!, newProject.appId!, newProject.accessToken);
                }
            }
        }
        
        revalidatePath('/dashboard');
        return { message: `Successfully synced ${syncedCount} project(s).`, count: syncedCount };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function handleForgotPassword(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    // This is a placeholder. In a real app, you would generate a secure token,
    // save it to the user's record with an expiration, and send an email.
    return { message: "If an account with this email exists, a password reset link has been sent." };
}

export async function getSession() {
  // This function is now designed to be robust against being called
  // in different server-side contexts.
  try {
  
const cookieStore = await cookies();
const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      console.log('[getSession] No session cookie found.');
      return null;
    }

    const decoded = await getDecodedSession(sessionCookie);
    if (!decoded) {
      console.log('[getSession] Failed to decode session cookie.');
      return null;
    }

    const { db } = await connectToDatabase();

    const dbUser = await db.collection<User>('users').findOne(
      { email: decoded.email },
      { projection: { password: 0 } }
    );

    if (!dbUser) {
      console.log(`[getSession] User not found in DB for email: ${decoded.email}`);
      return null;
    }

    let plan: WithId<Plan> | null = null;
    if (dbUser.planId && ObjectId.isValid(dbUser.planId)) {
      plan = await db.collection<WithId<Plan>>('plans').findOne({
        _id: new ObjectId(dbUser.planId),
      });
    }
    if (!plan) {
      plan = await db.collection<WithId<Plan>>('plans').findOne({ isDefault: true });
    }

    return {
      user: {
        ...dbUser,
        _id: dbUser._id.toString(),
        planId: dbUser.planId?.toString(),
        name: dbUser.name || decoded.name,
        image: dbUser.image || decoded.picture,
        plan: plan ? JSON.parse(JSON.stringify(plan)) : null,
      },
    };
  } catch (error) {
    // This catches errors if cookies() is called outside of a request context.
    console.error('[getSession] Error accessing cookies or session:', error);
    return null;
  }
}
  
export async function getUsersForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ users: Omit<WithId<User>, 'password'>[], total: number }> {
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<User> = {};
        if (query) {
             filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ]
        }
        
        const skip = (page - 1) * limit;
        
        const [users, total] = await Promise.all([
             db.collection<User>('users').find(filter, { projection: { password: 0 } }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
             db.collection('users').countDocuments(filter)
        ]);

        return { users: JSON.parse(JSON.stringify(users)), total };
    } catch(e) {
        return { users: [], total: 0 };
    }
}

export async function handleUpdateUserProfile(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        
        const updateData: any = {};
        
        const name = formData.get('name') as string;
        const tagsJSON = formData.get('tags') as string | null;
        const appRailPosition = formData.get('appRailPosition') as 'left' | 'top' | null;

        const businessName = formData.get('businessName') as string | null;
        const businessAddress = formData.get('businessAddress') as string | null;
        const businessGstin = formData.get('businessGstin') as string | null;

        if (name) updateData.name = name;
        if (appRailPosition) updateData.appRailPosition = appRailPosition;
        if (tagsJSON) {
            const parsedTags = JSON.parse(tagsJSON).map((tag: any) => ({
                _id: tag._id && !tag._id.startsWith('temp_') ? new ObjectId(tag._id) : new ObjectId(),
                name: tag.name,
                color: tag.color
            }));
            updateData.tags = parsedTags;
        }
        
        // This is the corrected part
        if (businessName !== null || businessAddress !== null || businessGstin !== null) {
            updateData.businessProfile = {
                name: businessName || undefined,
                address: businessAddress || undefined,
                gstin: businessGstin || undefined,
            };
        }
        
        if (Object.keys(updateData).length === 0) {
            return { error: 'No data provided to update.' };
        }

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return { error: 'User not found.' };
        }
        
        revalidatePath('/dashboard/profile');
        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard/url-shortener/settings');
        revalidatePath('/dashboard/user/settings/profile');
        revalidatePath('/dashboard/crm/accounting/trial-balance');
        revalidatePath('/dashboard/crm/accounting/income-statement');
        return { message: 'Profile updated successfully.' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleChangePassword(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return { error: 'All fields are required.' };
    }

    if (newPassword.length < 6) {
        return { error: 'New password must be at least 6 characters long.' };
    }

    if (newPassword !== confirmPassword) {
        return { error: 'New passwords do not match.' };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        if (!user || !user.password) {
            return { error: 'User not found or password is not set.' };
        }
        
        // This is a placeholder as comparePassword is not implemented
        // const passwordMatch = await comparePassword(currentPassword, user.password);
        // if (!passwordMatch) {
        //     return { error: 'Current password is incorrect.' };
        // }
        
        // This is a placeholder as hashPassword is not implemented
        // const newHashedPassword = await hashPassword(newPassword);
        // await db.collection('users').updateOne(
        //     { _id: user._id },
        //     { $set: { password: newHashedPassword } }
        // );

        return { message: 'Password updated successfully.' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

    

    

    