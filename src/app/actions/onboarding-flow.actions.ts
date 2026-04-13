'use server';

/**
 * Server actions powering the multi-step signup onboarding wizard.
 *
 * Flow: profile → business → requirements → plan → complete
 *
 * Each step persists into `user.onboarding.<key>` and advances
 * `user.onboarding.status` to the next step. The wizard on the client
 * reads `getOnboardingState()` to decide which step to render.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type { Plan, User } from '@/lib/definitions';

type ActionResult<T = unknown> = {
    success: boolean;
    error?: string;
    data?: T;
};

export type OnboardingState = NonNullable<User['onboarding']>;

async function requireUserId(): Promise<
    { ok: true; userId: ObjectId } | { ok: false; error: string }
> {
    const session = await getSession();
    if (!session?.user?._id) {
        return { ok: false, error: 'Not authenticated. Please sign in again.' };
    }
    if (!ObjectId.isValid(session.user._id as any)) {
        return { ok: false, error: 'Invalid session.' };
    }
    return { ok: true, userId: new ObjectId(session.user._id as string) };
}

export async function getOnboardingState(): Promise<{
    user: { _id: string; name: string; email: string } | null;
    onboarding: OnboardingState | null;
    enabledModules: string[];
}> {
    try {
        const session = await getSession();
        if (!session?.user) {
            return { user: null, onboarding: null, enabledModules: [] };
        }
        const user = session.user as any;
        return {
            user: {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
            },
            onboarding: (user.onboarding as OnboardingState) ?? null,
            enabledModules: (user.enabledModules as string[]) ?? [],
        };
    } catch (e) {
        console.error('[ONBOARDING] getOnboardingState failed', e);
        return { user: null, onboarding: null, enabledModules: [] };
    }
}

// --- Step 1: profile ------------------------------------------------------

export type ProfileStepInput = {
    fullName: string;
    companyName: string;
    role: string;
    phone: string;
    country: string;
    website?: string;
};

export async function saveOnboardingProfile(
    input: ProfileStepInput
): Promise<ActionResult> {
    try {
        const auth = await requireUserId();
        if (!auth.ok) return { success: false, error: auth.error };

        if (!input.fullName?.trim() || !input.companyName?.trim()) {
            return {
                success: false,
                error: 'Full name and company name are required.',
            };
        }
        if (!input.role?.trim() || !input.country?.trim()) {
            return {
                success: false,
                error: 'Role and country are required.',
            };
        }

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: auth.userId },
            {
                $set: {
                    name: input.fullName.trim(),
                    'onboarding.profile': {
                        companyName: input.companyName.trim(),
                        role: input.role.trim(),
                        phone: input.phone?.trim() || undefined,
                        country: input.country.trim(),
                        website: input.website?.trim() || undefined,
                    },
                    'onboarding.status': 'business',
                    'businessProfile.name': input.companyName.trim(),
                },
            }
        );

        revalidatePath('/onboarding');
        return { success: true };
    } catch (e) {
        console.error('[ONBOARDING] saveOnboardingProfile failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Step 2: business -----------------------------------------------------

export type BusinessStepInput = {
    industry: string;
    teamSize: string;
    monthlyVolume: string;
    useCases: string[];
};

export async function saveOnboardingBusiness(
    input: BusinessStepInput
): Promise<ActionResult> {
    try {
        const auth = await requireUserId();
        if (!auth.ok) return { success: false, error: auth.error };

        if (!input.industry || !input.teamSize || !input.monthlyVolume) {
            return {
                success: false,
                error: 'Industry, team size, and expected volume are required.',
            };
        }

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: auth.userId },
            {
                $set: {
                    'onboarding.business': {
                        industry: input.industry,
                        teamSize: input.teamSize,
                        monthlyVolume: input.monthlyVolume,
                        useCases: Array.isArray(input.useCases)
                            ? input.useCases
                            : [],
                    },
                    'onboarding.status': 'requirements',
                    crmIndustry: input.industry,
                },
            }
        );

        revalidatePath('/onboarding');
        return { success: true };
    } catch (e) {
        console.error('[ONBOARDING] saveOnboardingBusiness failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Step 3: requirements -------------------------------------------------

export type RequirementsStepInput = {
    modules: string[];
    primaryGoal: string;
    currentTools?: string;
    timeline?: string;
};

export async function saveOnboardingRequirements(
    input: RequirementsStepInput
): Promise<ActionResult> {
    try {
        const auth = await requireUserId();
        if (!auth.ok) return { success: false, error: auth.error };

        const modules = Array.isArray(input.modules)
            ? input.modules.filter((m) => typeof m === 'string' && m.length > 0)
            : [];
        if (modules.length === 0) {
            return {
                success: false,
                error: 'Select at least one module you want to enable.',
            };
        }
        if (!input.primaryGoal?.trim()) {
            return { success: false, error: 'Tell us your primary goal.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: auth.userId },
            {
                $set: {
                    'onboarding.requirements': {
                        modules,
                        primaryGoal: input.primaryGoal.trim(),
                        currentTools: input.currentTools?.trim() || undefined,
                        timeline: input.timeline?.trim() || undefined,
                    },
                    'onboarding.status': 'plan',
                    enabledModules: modules,
                },
            }
        );

        revalidatePath('/onboarding');
        return { success: true };
    } catch (e) {
        console.error('[ONBOARDING] saveOnboardingRequirements failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Step 4: plan ---------------------------------------------------------

export async function getOnboardingPlans(): Promise<WithId<Plan>[]> {
    try {
        const { db } = await connectToDatabase();
        const plans = await db
            .collection<Plan>('plans')
            .find({ isPublic: true })
            .sort({ price: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(plans));
    } catch (e) {
        console.error('[ONBOARDING] getOnboardingPlans failed', e);
        return [];
    }
}

export async function selectOnboardingPlan(
    planId: string
): Promise<ActionResult<{ requiresPayment: boolean; plan?: WithId<Plan> }>> {
    try {
        const auth = await requireUserId();
        if (!auth.ok) return { success: false, error: auth.error };

        if (!ObjectId.isValid(planId)) {
            return { success: false, error: 'Invalid plan selected.' };
        }

        const { db } = await connectToDatabase();
        const plan = await db
            .collection<Plan>('plans')
            .findOne({ _id: new ObjectId(planId) });
        if (!plan) return { success: false, error: 'Plan not found.' };

        const isFree = !plan.price || plan.price <= 0;

        await db.collection('users').updateOne(
            { _id: auth.userId },
            {
                $set: {
                    'onboarding.selectedPlanId': planId,
                    'onboarding.status': isFree ? 'complete' : 'plan',
                    ...(isFree
                        ? {
                              planId: plan._id,
                              'onboarding.completedAt': new Date(),
                          }
                        : {}),
                },
            }
        );

        revalidatePath('/onboarding');
        return {
            success: true,
            data: {
                requiresPayment: !isFree,
                plan: JSON.parse(JSON.stringify(plan)),
            },
        };
    } catch (e) {
        console.error('[ONBOARDING] selectOnboardingPlan failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Called after a successful Razorpay payment (or when the user chooses
 * to skip payment and continue on the default plan). Finalizes the
 * onboarding state and assigns the plan to the user.
 */
export async function completeOnboarding(args: {
    planId?: string;
    transactionId?: string;
}): Promise<ActionResult> {
    try {
        const auth = await requireUserId();
        if (!auth.ok) return { success: false, error: auth.error };

        const { db } = await connectToDatabase();
        const update: any = {
            'onboarding.status': 'complete',
            'onboarding.completedAt': new Date(),
        };

        if (args.planId && ObjectId.isValid(args.planId)) {
            update.planId = new ObjectId(args.planId);
            update['onboarding.selectedPlanId'] = args.planId;
        }
        if (args.transactionId) {
            update['onboarding.checkoutTransactionId'] = args.transactionId;
        }

        await db
            .collection('users')
            .updateOne({ _id: auth.userId }, { $set: update });

        // Safety net: if the user arrived via a team invite link, auto-attach
        // them once onboarding is complete (in case the client-side call in
        // account-step.tsx failed silently).
        try {
            const { consumePendingInviteToken } = await import('./team.actions');
            await consumePendingInviteToken();
        } catch { /* non-fatal */ }

        revalidatePath('/onboarding');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (e) {
        console.error('[ONBOARDING] completeOnboarding failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Skips the remaining onboarding steps. Marks status as 'complete' and
 * assigns the default free plan (if any). Called when the user clicks
 * "Skip for now" in the wizard header.
 */
export async function skipOnboarding(): Promise<ActionResult> {
    try {
        const auth = await requireUserId();
        if (!auth.ok) return { success: false, error: auth.error };

        const { db } = await connectToDatabase();

        // Find the default/free plan so the user isn't left without one
        const defaultPlan = await db
            .collection<Plan>('plans')
            .findOne({ $or: [{ isDefault: true }, { price: { $lte: 0 } }] });

        const update: Record<string, unknown> = {
            'onboarding.status': 'complete',
            'onboarding.completedAt': new Date(),
            'onboarding.skippedAt': new Date(),
        };
        if (defaultPlan) {
            update.planId = defaultPlan._id;
            update['onboarding.selectedPlanId'] = defaultPlan._id.toString();
        }

        await db
            .collection('users')
            .updateOne({ _id: auth.userId }, { $set: update });

        revalidatePath('/onboarding');
        revalidatePath('/dashboard');
        revalidatePath('/home');
        return { success: true };
    } catch (e) {
        console.error('[ONBOARDING] skipOnboarding failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Allows the wizard to jump to any earlier step for editing.
 */
export async function rewindOnboardingTo(
    step: OnboardingState['status']
): Promise<ActionResult> {
    try {
        const auth = await requireUserId();
        if (!auth.ok) return { success: false, error: auth.error };

        const allowed: OnboardingState['status'][] = [
            'profile',
            'business',
            'requirements',
            'plan',
            'complete',
        ];
        if (!allowed.includes(step)) {
            return { success: false, error: 'Invalid step.' };
        }

        const { db } = await connectToDatabase();
        await db
            .collection('users')
            .updateOne(
                { _id: auth.userId },
                { $set: { 'onboarding.status': step } }
            );

        revalidatePath('/onboarding');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
