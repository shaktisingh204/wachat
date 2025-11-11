
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmDeal, CrmContact, CrmAccount, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';

export async function getCrmDeals(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ deals: WithId<CrmDeal>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { deals: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Filter<CrmDeal> = { userId: userObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.name = queryRegex; // Assuming we search by deal name/subject
        }
        
        const skip = (page - 1) * limit;

        const [deals, total] = await Promise.all([
            db.collection<CrmDeal>('crm_deals').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_deals').countDocuments(filter)
        ]);

        return {
            deals: JSON.parse(JSON.stringify(deals)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM deals:", e);
        return { deals: [], total: 0 };
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
    } catch (e) {
        return null;
    }
}

export async function createCrmDeal(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const newDealData: Partial<CrmDeal> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            value: Number(formData.get('value')),
            currency: formData.get('currency') as string,
            stage: formData.get('stage') as string,
            pipelineId: formData.get('pipelineId') as string,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const accountId = formData.get('accountId') as string;
        if (accountId && ObjectId.isValid(accountId)) {
            newDealData.accountId = new ObjectId(accountId);
        }
        
        const contactId = formData.get('contactId') as string;
        if (contactId && ObjectId.isValid(contactId)) {
            newDealData.contactIds = [new ObjectId(contactId)];
        }

        const closeDateStr = formData.get('closeDate') as string;
        if (closeDateStr) {
            newDealData.closeDate = new Date(closeDateStr);
        }

        if (!newDealData.name || isNaN(newDealData.value) || !newDealData.stage) {
            return { error: 'Deal Name, Value, and Stage are required.' };
        }
        
        const { db } = await connectToDatabase();
        await db.collection('crm_deals').insertOne(newDealData as CrmDeal);
        revalidatePath('/dashboard/crm/deals');
        return { message: 'New deal created successfully.' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmLeadAndDeal(
    prevState: any, 
    formData: FormData,
    apiUser?: WithId<User>
): Promise<{ message?: string, error?: string, contactId?: string, dealId?: string }> {
    const session = apiUser ? { user: apiUser } : await getSession();
    if (!session?.user) {
        return { error: 'Access denied' };
    }
    
    try {
        const { db } = await connectToDatabase();
        
        // --- Find or Create Account ---
        const companyName = formData.get('company') as string | null;
        let accountId: ObjectId | undefined;
        if (companyName) {
            const accountResult = await db.collection('crm_accounts').findOneAndUpdate(
                { name: companyName, userId: session.user._id },
                { $setOnInsert: { name: companyName, userId: session.user._id, createdAt: new Date(), status: 'active' } },
                { upsert: true, returnDocument: 'after' }
            );
            accountId = accountResult?._id;
        }

        // --- Find or Create Contact ---
        const contactEmail = formData.get('email') as string;
        if (!contactEmail) return { error: 'Contact Email is required.' };
        
        const contactResult = await db.collection('crm_contacts').findOneAndUpdate(
            { email: contactEmail, userId: session.user._id },
            { 
                $setOnInsert: {
                    name: formData.get('contactName') as string,
                    email: contactEmail,
                    phone: formData.get('phone') as string,
                    company: companyName || undefined,
                    jobTitle: formData.get('designation') as string | undefined,
                    userId: session.user._id,
                    accountId: accountId,
                    status: 'new_lead',
                    createdAt: new Date(),
                    tags: (formData.get('tagIds') as string)?.split(',').filter(Boolean) || [],
                }
            },
            { upsert: true, returnDocument: 'after' }
        );
        const contactId = contactResult?._id;
        if (!contactId) return { error: 'Failed to create or find contact.' };

        // --- Create Deal ---
        const dealStages = getDealStagesForIndustry(session.user.crmIndustry);
        const newDealData: Omit<CrmDeal, '_id'> = {
            userId: session.user._id,
            name: formData.get('name') as string,
            value: Number(formData.get('value') || 0),
            currency: 'INR',
            stage: (formData.get('stage') as string) || dealStages[0] || 'New Lead',
            leadSource: formData.get('leadSource') as string | undefined,
            pipelineId: formData.get('pipelineId') as string | undefined,
            accountId: accountId,
            contactIds: [contactId],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (!newDealData.name) {
            return { error: 'Lead Subject (Deal Name) is required.' };
        }

        const dealResult = await db.collection('crm_deals').insertOne(newDealData as any);

        revalidatePath('/dashboard/crm/deals');
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        return { message: 'Lead created successfully.', contactId: contactId.toString(), dealId: dealResult.insertedId.toString() };
        
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateCrmDealStage(dealId: string, newStage: string) {
    if (!ObjectId.isValid(dealId)) return { success: false, error: 'Invalid Deal ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId), userId: new ObjectId(session.user._id) },
            { $set: { stage: newStage, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Deal not found or permission denied.' };
        }
        revalidatePath('/dashboard/crm/deals');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
