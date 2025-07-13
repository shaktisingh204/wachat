

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmDeal } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';

export async function getCrmDeals(): Promise<WithId<CrmDeal>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const deals = await db.collection<CrmDeal>('crm_deals')
            .find({ userId: new ObjectId(session.user._id) })
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

    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const deal = await db.collection<CrmDeal>('crm_deals').findOne({ 
            _id: new ObjectId(dealId),
            userId: new ObjectId(session.user._id)
        });
        
        return deal ? JSON.parse(JSON.stringify(deal)) : null;
    } catch(e) {
        return null;
    }
}


export async function createCrmDeal(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const dealStages = getDealStagesForIndustry(session.user.crmIndustry);
        const newDeal: Omit<CrmDeal, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            value: parseFloat(formData.get('value') as string),
            currency: formData.get('currency') as string,
            stage: (formData.get('stage') as CrmDeal['stage']) || dealStages[0],
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

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const { db } = await connectToDatabase();
    
    try {
        const result = await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId), userId: new ObjectId(session.user._id) },
            { $set: { stage: newStage, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Deal not found or you do not have access.' };
        }
        
        revalidatePath('/dashboard/crm/deals');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
