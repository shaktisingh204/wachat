
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter } from 'mongodb';
import { getAdminSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { Plan, PlanFeaturePermissions } from '@/lib/definitions';
import { planFeaturesDefaults } from '@/app/actions';


export async function getPlans(filter?: Filter<Plan>): Promise<WithId<Plan>[]> {
    try {
        const { db } = await connectToDatabase();
        const plans = await db.collection('plans').find(filter || {}).sort({ price: 1 }).toArray();
        return JSON.parse(JSON.stringify(plans));
    } catch (error) {
        console.error("Failed to fetch plans:", error);
        return [];
    }
}

export async function getPlanById(planId: string): Promise<WithId<Plan> | null> {
    if (!ObjectId.isValid(planId)) return null;
    try {
        const { db } = await connectToDatabase();
        const plan = await db.collection('plans').findOne({ _id: new ObjectId(planId) });
        return plan ? JSON.parse(JSON.stringify(plan)) : null;
    } catch (error) {
        console.error('Failed to fetch plan by ID:', error);
        return null;
    }
}

export async function savePlan(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    const planId = formData.get('planId') as string;
    const isNew = planId === 'new';

    try {
        const features: Partial<PlanFeaturePermissions> = {};
        for(const key of Object.keys(planFeaturesDefaults)) {
            features[key as keyof PlanFeaturePermissions] = formData.get(key) === 'on';
        }

        const planData: Omit<Plan, '_id' | 'createdAt'> = {
            name: formData.get('name') as string,
            price: Number(formData.get('price')),
            currency: formData.get('currency') as string,
            isPublic: formData.get('isPublic') === 'on',
            isDefault: formData.get('isDefault') === 'on',
            projectLimit: Number(formData.get('projectLimit')),
            agentLimit: Number(formData.get('agentLimit')),
            attributeLimit: Number(formData.get('attributeLimit')),
            templateLimit: Number(formData.get('templateLimit')),
            flowLimit: Number(formData.get('flowLimit')),
            metaFlowLimit: Number(formData.get('metaFlowLimit')),
            cannedMessageLimit: Number(formData.get('cannedMessageLimit')),
            signupCredits: Number(formData.get('signupCredits') || 0),
            messageCosts: {
                marketing: Number(formData.get('cost_marketing')),
                utility: Number(formData.get('cost_utility')),
                authentication: Number(formData.get('cost_authentication')),
            },
            features: features as PlanFeaturePermissions,
        };

        if (!planData.name || isNaN(planData.price)) {
            return { error: 'Plan name and price are required.' };
        }
        
        const { db } = await connectToDatabase();
        
        if (planData.isDefault) {
            await db.collection('plans').updateMany({ _id: { $ne: isNew ? new ObjectId() : new ObjectId(planId) } }, { $set: { isDefault: false } });
        }

        if (isNew) {
            await db.collection('plans').insertOne({ ...planData, createdAt: new Date() } as any);
        } else {
            await db.collection('plans').updateOne({ _id: new ObjectId(planId) }, { $set: planData });
        }

        revalidatePath('/admin/dashboard/plans');
        return { message: `Plan "${planData.name}" has been saved successfully.` };

    } catch (e: any) {
        console.error('Failed to save plan:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function deletePlan(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    const planId = formData.get('planId') as string;
    if (!planId || !ObjectId.isValid(planId)) {
        return { error: 'Invalid Plan ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const planObjectId = new ObjectId(planId);
        
        const plan = await db.collection('plans').findOne({ _id: planObjectId });
        if (plan?.isDefault) {
            return { error: 'Cannot delete the default plan.' };
        }

        await db.collection('plans').deleteOne({ _id: planObjectId });

        revalidatePath('/admin/dashboard/plans');
        return { message: `Plan successfully deleted.` };

    } catch (e: any) {
        console.error('Failed to delete plan:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}
