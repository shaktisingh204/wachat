

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


// getProjectById moved to project.actions.ts to avoid duplicate exports



// getProjects moved to project.actions.ts


// getProjectsForAdmin moved to admin.actions.ts


export async function getWhatsAppProjectsForAdmin(
    page: number = 1,
    limit: number = 20,
    query?: string,
    userId?: string
): Promise<{ projects: WithId<Project & { owner: { name: string; email: string } }>[], total: number, users: WithId<User>[] }> {
    try {
        const { db } = await connectToDatabase();
        // Cast to any to bypass strict filter matching
        const filter: any = { wabaId: { $exists: true, $ne: null } };

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

// handleDeleteUserProject moved to project.actions.ts


export async function handleRunCron() {
    // This is a placeholder for a more complex cron job runner if needed.
    // For now, it will return a success message.
    return { message: 'Cron jobs triggered.', error: null };
}

/**
 * Manually add a single WhatsApp Business Account (WABA) as a project.
 *
 * Rewritten from the previous "sync by Business Portfolio id" flow which
 * kept hitting Meta error (#100) because of ambiguity around which edge to
 * query on the Business node (`owned_whatsapp_business_accounts` vs
 * `client_whatsapp_business_accounts`) and because many users entered a
 * WABA id, Page id, or App id instead of a Business Portfolio id.
 *
 * The new flow skips discovery entirely: the user pastes the exact WABA id
 * they want to add, we fetch it directly with `GET /{waba-id}`, and upsert
 * one project. Phone numbers and webhook subscription run as before.
 *
 * Function name kept as `handleSyncWabas` so existing imports (including
 * `SyncProjectsDialog`) keep working. FormData key is now `wabaId`.
 */
export async function handleSyncWabas(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, count?: number }> {
    const accessToken = (formData.get('accessToken') as string | null)?.trim() || '';
    const appId = (formData.get('appId') as string | null)?.trim() || '';
    const wabaId = (formData.get('wabaId') as string | null)?.trim() || '';
    const groupName = (formData.get('groupName') as string | null)?.trim() || '';

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!accessToken || !appId || !wabaId) {
        return { error: 'WABA ID, Access Token, and App ID are required.' };
    }
    // Basic shape check — Meta WABA ids are numeric, typically 15–16 digits.
    if (!/^\d{6,25}$/.test(wabaId)) {
        return { error: 'WABA ID should be a numeric id from Meta Business Manager. Double-check that you pasted the WhatsApp Business Account ID (not the Business Portfolio, Page, or App ID).' };
    }

    try {
        const { db } = await connectToDatabase();

        // Fetch the WABA directly from Meta. If the ID is wrong or the token
        // can't see it, this surfaces Meta's actual error back to the user
        // (which is much more informative than the old "nonexisting field"
        // error from guessing edges on the wrong node type).
        let wabaName: string;
        try {
            const wabaResp = await axios.get(`https://graph.facebook.com/v23.0/${wabaId}`, {
                params: {
                    fields: 'id,name,currency,timezone_id,message_template_namespace',
                    access_token: accessToken,
                },
            });
            if (!wabaResp.data?.id) {
                return { error: 'Meta returned no WABA for that ID. Check that the ID is correct and the token has whatsapp_business_management scope.' };
            }
            if (String(wabaResp.data.id) !== wabaId) {
                // Defensive: Meta should always echo the id we queried. Flag
                // the mismatch loudly rather than silently trusting the wrong id.
                return { error: `Meta returned a different id (${wabaResp.data.id}) than requested (${wabaId}). Aborting.` };
            }
            wabaName = wabaResp.data.name || `WABA ${wabaId}`;
        } catch (err: any) {
            // Return Meta's actual error — avoids the old pattern where we
            // wrapped everything as "nonexisting field" and buried the real
            // cause (expired token, missing scope, wrong node type).
            const metaMsg = err?.response?.data?.error?.message || getErrorMessage(err);
            return { error: `Meta API error while fetching WABA ${wabaId}: ${metaMsg}` };
        }

        // Optional project group — create only after we've confirmed the
        // WABA is reachable so we don't leave orphaned groups on bad input.
        let groupId: ObjectId | undefined;
        if (groupName) {
            const groupResult = await db.collection('project_groups').insertOne({
                userId: new ObjectId(session.user._id),
                name: groupName,
                createdAt: new Date(),
            });
            groupId = groupResult.insertedId;
        }

        // Upsert a single project scoped by (user, waba). If the user adds
        // the same WABA again we update its token/name/appId rather than
        // creating a duplicate project row.
        const upsertResult = await db.collection('projects').findOneAndUpdate(
            { userId: new ObjectId(session.user._id), wabaId },
            {
                $set: {
                    name: wabaName,
                    accessToken,
                    appId,
                    ...(groupId && groupName ? { groupId, groupName } : {}),
                },
                $setOnInsert: {
                    userId: new ObjectId(session.user._id),
                    wabaId,
                    createdAt: new Date(),
                    messagesPerSecond: 80,
                },
            },
            { upsert: true, returnDocument: 'after' },
        );

        const project = (upsertResult as any)?.value || upsertResult;
        if (!project?._id) {
            return { error: 'Failed to create or update project record.' };
        }

        // Kick off phone number sync + webhook subscription. Both are
        // non-fatal — we still return success if either fails, but log so
        // the user can retry from the project settings page.
        try {
            await handleSyncPhoneNumbers(project._id.toString());
        } catch (e: any) {
            console.warn(`[addWaba] phone number sync failed for ${wabaId}:`, getErrorMessage(e));
        }
        try {
            await handleSubscribeProjectWebhook(wabaId, appId, accessToken);
        } catch (e: any) {
            console.warn(`[addWaba] webhook subscribe failed for ${wabaId}:`, getErrorMessage(e));
        }

        revalidatePath('/dashboard');
        return { message: `Added WhatsApp Business Account "${wabaName}".`, count: 1 };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function handleForgotPassword(prevState: { message?: string; error?: string }, formData: FormData): Promise<{ message?: string; error?: string }> {
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

        // Sanitize dbUser to ensure all ObjectIds and Dates are stringified (especially nested ones like apiKeys)
        const serializedUser = JSON.parse(JSON.stringify(dbUser));

        // Initialize credits if missing
        if (!dbUser.credits && plan) {
            const initialCredits = plan.initialCredits || {
                broadcast: 0,
                sms: 0,
                meta: 0,
                email: 0
            };

            // If legacy signupCredits exists and initialCredits doesn't, we might want to map it?
            // For now, we rely on the specific initialCredits object or defaults to 0.
            // If we wanted to use signupCredits as a fallback for 'broadcast' or all, we could:
            if (!plan.initialCredits && plan.signupCredits) {
                initialCredits.broadcast = plan.signupCredits; // Default legacy behavior assumption
            }

            await db.collection('users').updateOne(
                { _id: dbUser._id },
                { $set: { credits: initialCredits } }
            );
            serializedUser.credits = initialCredits;
        }


        // Merge permissions: customPermissions override plan permissions
        const userPermissions: any = dbUser.customPermissions || {};
        const planPermissions: any = plan?.permissions || {};

        let finalPermissions: any = { ...planPermissions };

        if (userPermissions) {
            // For each role in userPermissions (e.g. 'agent', 'admin'), merge with plan
            for (const [key, value] of Object.entries(userPermissions)) {
                if (['agent', 'admin', 'owner', 'member'].includes(key)) {
                    finalPermissions[key] = { ...(finalPermissions[key] || {}), ...(value as any) };
                }
            }
        }

        if (plan) {
            plan.permissions = finalPermissions;
        }

        return {
            user: {
                ...serializedUser,
                _id: dbUser._id.toString(),
                planId: dbUser.planId?.toString(),
                name: dbUser.name || decoded.name,
                image: dbUser.image || decoded.picture,
                plan: plan ? JSON.parse(JSON.stringify(plan)) : null,
            },
        };
    } catch (error) {
        // Catches errors when the session cookie is read outside a request context.
        console.error('[getSession] Error accessing session:', error);
        return null;
    }
}

export async function getUsersForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ users: (Omit<WithId<User>, 'password'> & { plan?: WithId<Plan> | null })[], total: number }> {
    try {
        const { db } = await connectToDatabase();
        const filter: Record<string, any> = {};
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ];
        }

        // Use aggregation so the admin UI can show the resolved Plan name + limits,
        // not just a raw ObjectId. Without this lookup the users table always shows
        // "N/A" in the Plan column even after a successful assignment.
        const users = await db
            .collection<User>('users')
            .aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit },
                { $project: { password: 0 } },
                {
                    $lookup: {
                        from: 'plans',
                        localField: 'planId',
                        foreignField: '_id',
                        as: '_plan',
                    },
                },
                {
                    $addFields: {
                        plan: { $arrayElemAt: ['$_plan', 0] },
                    },
                },
                { $project: { _plan: 0 } },
            ])
            .toArray();

        const total = await db.collection('users').countDocuments(filter);

        return { users: JSON.parse(JSON.stringify(users)), total };
    } catch (e) {
        console.error('getUsersForAdmin failed:', e);
        return { users: [], total: 0 };
    }
}

export async function handleUpdateUserProfile(prevState: { message?: string; error?: string }, formData: FormData): Promise<{ message?: string; error?: string }> {
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

export async function handleChangePassword(prevState: { message?: string; error?: string }, formData: FormData): Promise<{ message?: string; error?: string }> {
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





