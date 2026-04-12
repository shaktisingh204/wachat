
'use server';

import type { WithId, User } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

async function loadPlanForUser(user: WithId<User>) {
    if (!user.planId) return null;
    try {
        const { db } = await connectToDatabase();
        const plan = await db.collection('plans').findOne({ _id: new ObjectId(user.planId.toString()) });
        return plan;
    } catch {
        return null;
    }
}

function hasFeatureIn(features: any, feature: string): boolean {
    if (!features || typeof features !== 'object') return false;
    // PlanFeaturePermissions is a flat map of feature keys → boolean or object
    const val = features[feature];
    if (typeof val === 'boolean') return val;
    if (val && typeof val === 'object') {
        // Object-shaped features: look for explicit enablement flags
        const obj = val as Record<string, any>;
        return Boolean(obj.view || obj.enabled || obj.use || obj.access);
    }
    return false;
}

export async function executeSubscriptionBillingAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        switch (actionName) {
            case 'getCurrentPlan': {
                const plan = await loadPlanForUser(user);
                if (!plan) {
                    return {
                        output: {
                            planId: null,
                            planName: 'Free',
                            status: 'no_plan',
                        },
                    };
                }
                logger.log(`[SubscriptionBilling] Current plan: ${plan.name}`);
                return {
                    output: {
                        planId: plan._id?.toString(),
                        planName: plan.name,
                        status: 'active',
                    },
                };
            }

            case 'checkFeature': {
                const feature = String(inputs.feature ?? '').trim();
                if (!feature) throw new Error('feature is required.');
                const plan = await loadPlanForUser(user);
                const hasFeature = plan ? hasFeatureIn(plan.features, feature) : false;
                return {
                    output: {
                        hasFeature: String(hasFeature),
                        planName: plan?.name ?? 'Free',
                    },
                };
            }

            case 'getUsage': {
                const credits = (user as any).credits || {};
                const wallet = (user as any).wallet || null;
                const usage = {
                    credits: {
                        broadcast: credits.broadcast ?? 0,
                        sms: credits.sms ?? 0,
                        meta: credits.meta ?? 0,
                        email: credits.email ?? 0,
                        seo: credits.seo ?? 0,
                    },
                    wallet: wallet
                        ? { balance: wallet.balance ?? 0, currency: wallet.currency ?? 'INR' }
                        : null,
                };
                return { output: { usage } };
            }

            default:
                return { error: `Subscription Billing action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Subscription Billing action failed.' };
    }
}
