

'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type WithId, ObjectId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { createSessionToken, verifyJwt, hashPassword, comparePassword, createAdminSessionToken, verifyAdminJwt, type SessionPayload, type AdminSessionPayload } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';
import type { Project, User, Plan, Invitation } from '@/lib/definitions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { headers } from 'next/headers';
import { processBroadcastJob } from '@/lib/cron-scheduler';
import { handleSubscribeProjectWebhook } from '@/app/actions/whatsapp.actions';

export async function getProjectById(projectId: string, userId?: string) {
    if (!ObjectId.isValid(projectId)) {
        console.error("Invalid Project ID in getProjectById:", projectId);
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);

        let query: Filter<Project> = { _id: projectObjectId };

        if (!userId) {
            const session = await getSession();
            if (!session?.user) return null;
            userId = session.user._id;
        }

        query = {
            ...query,
            $or: [
                { userId: new ObjectId(userId) },
                { 'agents.userId': new ObjectId(userId) }
            ]
        };
        
        const project = await db.collection('projects').findOne(query);

        if (!project) return null;
        
        const plan = project.planId ? await db.collection('plans').findOne({ _id: project.planId }) : null;
        const finalProject = { ...project, plan };
        
        return JSON.parse(JSON.stringify(finalProject));
    } catch (error) {
        console.error("Failed to fetch project by ID:", error);
        return null;
    }
}

export async function getProjects(query?: string, type?: 'whatsapp' | 'facebook'): Promise<{ projects: WithId<Project>[] }> {
    const session = await getSession();
    if (!session?.user) {
        return { projects: [] };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

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
            projectFilter.wabaId = { $exists: true, $ne: null };
        } else if (type === 'facebook') {
            projectFilter.facebookPageId = { $exists: true, $ne: null };
            projectFilter.wabaId = { $exists: false }; // Exclude whatsapp projects
        }


        const projects = await db.collection<Project>('projects')
            .find(projectFilter)
            .sort({ createdAt: -1 })
            .toArray();

        return { projects: JSON.parse(JSON.stringify(projects)) };
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        return { projects: [] };
    }
}

export async function getAllProjectsForAdmin(
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
    try {
        const result = await processBroadcastJob();
        return { message: result.message, error: null };
    } catch (e: any) {
        return { message: null, error: e.message || 'An unknown error occurred.' };
    }
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

export async function getAdminSession(): Promise<{ isAdmin: boolean }> {
    const cookieStore = cookies();
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

export async function handleLogin(prevState: any, formData: FormData): Promise<{ error?: string }> {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || '127.0.0.1';

    const { success, error } = await checkRateLimit(`login:${ip}`, 10, 60 * 1000); // 10 attempts per minute
    if (!success) {
        return { error };
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ email: email.toLowerCase() });

        if (!user || !user.password) {
            return { error: 'Invalid email or password.' };
        }

        const passwordMatch = await comparePassword(password, user.password);

        if (!passwordMatch) {
            return { error: 'Invalid email or password.' };
        }

        const sessionToken = await createSessionToken({ userId: user._id.toString(), email: user.email });
        cookies().set('session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

        redirect('/dashboard');

    } catch (e: any) {
        return { error: e.message || 'An unexpected server error occurred.' };
    }
}

export async function handleSignup(prevState: any, formData: FormData): Promise<{ error?: string }> {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || '127.0.0.1';

    const { success, error } = await checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000); // 5 signups per hour
    if (!success) {
        return { error };
    }
    
    const name = formData.get('name') as string;
    const email = (formData.get('email') as string).toLowerCase();
    const password = formData.get('password') as string;

    if (password.length < 6) {
        return { error: 'Password must be at least 6 characters long.' };
    }

    try {
        const { db } = await connectToDatabase();

        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return { error: 'A user with this email already exists.' };
        }

        const hashedPassword = await hashPassword(password);
        const defaultPlan = await db.collection('plans').findOne({ isDefault: true });

        const newUser: Omit<User, '_id'> = {
            name,
            email,
            password: hashedPassword,
            createdAt: new Date(),
            ...(defaultPlan && { planId: defaultPlan._id, credits: defaultPlan.signupCredits || 0 }),
        };

        const result = await db.collection('users').insertOne(newUser as User);

        const sessionToken = await createSessionToken({ userId: result.insertedId.toString(), email: newUser.email });
        cookies().set('session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

        redirect('/dashboard');
        
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred during signup.' };
    }
}

export async function handleForgotPassword(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    // This is a placeholder. In a real app, you would generate a secure token,
    // save it to the user's record with an expiration, and send an email.
    return { message: "If an account with this email exists, a password reset link has been sent." };
}

export async function getSession() {
    const sessionToken = cookies().get('session')?.value;
    if (!sessionToken) return null;

    const payload = await verifyJwt(sessionToken);
    if (!payload) return null;

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(payload.userId) },
            { projection: { password: 0 } }
        );

        if (!user) return null;
        
        const plan = user.planId ? await db.collection('plans').findOne({ _id: user.planId }) : await db.collection('plans').findOne({ isDefault: true });

        return {
            user: {
                ...user,
                plan,
            }
        };

    } catch (e: any) {
        console.error("Session retrieval failed:", e);
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

    const name = formData.get('name') as string;
    const tagsJSON = formData.get('tags') as string | null;

    if (!name && !tagsJSON) {
        return { error: 'No data provided to update.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const updateData: any = {};
        if (name) {
            updateData.name = name;
        }
        if (tagsJSON) {
            // This ensures we save tags with ObjectIDs if they are new
            const parsedTags = JSON.parse(tagsJSON).map((tag: any) => ({
                _id: tag._id && !tag._id.startsWith('temp_') ? new ObjectId(tag._id) : new ObjectId(),
                name: tag.name,
                color: tag.color
            }));
            updateData.tags = parsedTags;
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
        
        const passwordMatch = await comparePassword(currentPassword, user.password);
        if (!passwordMatch) {
            return { error: 'Current password is incorrect.' };
        }
        
        const newHashedPassword = await hashPassword(newPassword);
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { password: newHashedPassword } }
        );

        return { message: 'Password updated successfully.' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
