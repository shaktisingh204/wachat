
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { CrmDeal } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmDeals(projectId: string): Promise<WithId<CrmDeal>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const deals = await db.collection<CrmDeal>('crm_deals')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(deals));
    } catch (e) {
        console.error("Failed to fetch CRM deals:", e);
        return [];
    }
}

export async function getCrmDealById(dealId: string): Promise<WithId<CrmDeal> | null> {
    if (!ObjectId.isValid(dealId)) return null;

    try {
        const { db } = await connectToDatabase();
        const deal = await db.collection<CrmDeal>('crm_deals').findOne({ _id: new ObjectId(dealId) });
        if (!deal) return null;
        
        const hasAccess = await getProjectById(deal.projectId.toString());
        if (!hasAccess) return null;

        return JSON.parse(JSON.stringify(deal));
    } catch(e) {
        return null;
    }
}


export async function createCrmDeal(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const project = await getProjectById(projectId);
    if (!project) return { error: "Access denied" };

    try {
        const newDeal: Omit<CrmDeal, '_id'> = {
            projectId: new ObjectId(projectId),
            name: formData.get('name') as string,
            value: parseFloat(formData.get('value') as string),
            currency: formData.get('currency') as string,
            stage: (formData.get('stage') as CrmDeal['stage']) || 'New',
            closeDate: new Date(formData.get('closeDate') as string),
            accountId: new ObjectId(formData.get('accountId') as string),
            contactIds: [new ObjectId(formData.get('contactId') as string)],
            createdAt: new Date(),
        };

        const { db } = await connectToDatabase();
        await db.collection('crm_deals').insertOne(newDeal as any);
        
        revalidatePath('/dashboard/crm/deals');
        return { message: 'Deal created successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateCrmDealStage(dealId: string, newStage: CrmDeal['stage']): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(dealId)) {
        return { success: false, error: 'Invalid Deal ID.' };
    }

    const { db } = await connectToDatabase();
    const deal = await db.collection('crm_deals').findOne({ _id: new ObjectId(dealId) });
    if (!deal) return { success: false, error: 'Deal not found.' };

    const hasAccess = await getProjectById(deal.projectId.toString());
    if (!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId) },
            { $set: { stage: newStage, updatedAt: new Date() } }
        );
        
        revalidatePath('/dashboard/crm/deals');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
