// This file is intentionally left blank.
// Server actions are co-located in their respective feature files (e.g., src/app/actions/project.actions.ts).
// This file can be used for global actions if needed in the future.
'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type WithId, ObjectId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { createSessionToken, verifySessionToken, hashPassword, comparePassword } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';
import type { Project, User, Plan, Invitation } from '@/lib/definitions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { headers } from 'next/headers';
import { processBroadcastJob } from '@/lib/cron-scheduler';
import { handleSubscribeProjectWebhook } from '@/app/actions/whatsapp.actions';

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

    const payload = await verifySessionToken(sessionToken);
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


export async function getProjectById(projectId: string, apiUserId?: string): Promise<(WithId<Project> & { plan?: WithId<Plan> | null }) | null> {
    if (!ObjectId.isValid(projectId)) {
        return null;
    }
    
    let currentUserId: string;

    if (apiUserId) {
        currentUserId = apiUserId;
    } else {
        const session = await getSession();
        if (!session?.user) {
            return null;
        }
        currentUserId = session.user._id.toString();
    }
    
    const { db } = await connectToDatabase();
    
    try {
        const project = await db.collection<Project>('projects').findOne({
            _id: new ObjectId(projectId),
            $or: [
                { userId: new ObjectId(currentUserId) },
                { 'agents.userId': new ObjectId(currentUserId) }
            ]
        });

        if (!project) {
            return null;
        }

        const plan = project.planId ? await db.collection('plans').findOne({ _id: project.planId }) : await db.collection('plans').findOne({ isDefault: true });
        
        return { ...JSON.parse(JSON.stringify(project)), plan: JSON.parse(JSON.stringify(plan)) };
    } catch (e) {
        return null;
    }
}

export async function getProjects(query?: string, type?: 'whatsapp' | 'facebook'): Promise<{ projects: WithId<Project>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { projects: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        
        const filter: Filter<Project> = {
            $or: [
                { userId: new ObjectId(session.user._id) },
                { 'agents.userId': new ObjectId(session.user._id) },
            ]
        };

        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }
        
        if (type === 'whatsapp') {
            filter.wabaId = { $exists: true, $ne: null };
        } else if (type === 'facebook') {
            filter.facebookPageId = { $exists: true, $ne: null };
            filter.wabaId = { $exists: false };
        }
        
        const [projects, total] = await Promise.all([
            db.collection('projects').find(filter).sort({ createdAt: -1 }).toArray(),
            db.collection('projects').countDocuments(filter),
        ]);

        return { projects: JSON.parse(JSON.stringify(projects)), total };

    } catch (error) {
        console.error("Failed to fetch projects:", error);
        return { projects: [], total: 0 };
    }
}


export async function getAllProjectsForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ projects: (WithId<Project> & { plan?: WithId<Plan> | null })[], total: number }> {
    // In a real app, this would check for admin privileges.
    // For this prototype, we'll assume the check happens in the page component.
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = {};
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { wabaId: { $regex: query, $options: 'i' } },
            ]
        }
        
        const skip = (page - 1) * limit;

        const projects = await db.collection('projects').aggregate([
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
            {
                $addFields: {
                    plan: { $arrayElemAt: ['$planInfo', 0] }
                }
            },
            {
                $project: {
                    planInfo: 0
                }
            }
        ]).toArray();
        
        const total = await db.collection('projects').countDocuments(filter);

        return { projects: JSON.parse(JSON.stringify(projects)), total };
    } catch(e) {
        return { projects: [], total: 0 };
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

export async function handleRunCron() {
  try {
    const result = await processBroadcastJob();
    return {
      message: `Cron job finished. Success: ${result.totalSuccess}, Failed: ${result.totalFailed}.`,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function handleSubscribeAllProjects() {
    try {
        const { db } = await connectToDatabase();
        const projects = await db.collection<Project>('projects').find(
            { wabaId: { $exists: true }, accessToken: { $exists: true } },
            { projection: { wabaId: 1, accessToken: 1, appId: 1 } }
        ).toArray();

        let successCount = 0;
        let failCount = 0;

        for (const project of projects) {
            if (project.wabaId && project.accessToken && project.appId) {
                const result = await handleSubscribeProjectWebhook(project.wabaId, project.appId, project.accessToken);
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } else {
                failCount++;
            }
        }
        
        return { message: `Subscribed ${successCount} projects. Failed for ${failCount} projects.` };

    } catch (error: any) {
        return { error: error.message };
    }
}
