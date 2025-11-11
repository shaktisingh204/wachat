

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
            filter.name = { $regex: query, $options: 'i' };
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
        return { deals: [], total: 0 };
    }
}

export async function createCrmDeal(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const dealData: Partial<Omit<CrmDeal, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            value: Number(formData.get('value')),
            currency: formData.get('currency') as string,
            stage: formData.get('stage') as string,
            accountId: new ObjectId(formData.get('accountId') as string),
            contactIds: [new ObjectId(formData.get('contactId') as string)],
        };
        
        const closeDateStr = formData.get('closeDate') as string;
        if(closeDateStr) {
            dealData.closeDate = new Date(closeDateStr);
        }

        if (!dealData.name || !dealData.value || !dealData.stage || !dealData.accountId || !dealData.contactIds) {
            return { error: 'All fields are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_deals').insertOne({ ...dealData, createdAt: new Date() } as CrmDeal);
        
        revalidatePath('/dashboard/crm/deals');
        return { message: 'Deal created successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function addCrmLeadAndDeal(prevState: any, formData: FormData, apiUser?: WithId<User>): Promise<{ message?: string; error?: string, contactId?: string, dealId?: string }> {
    const session = apiUser ? { user: apiUser } : await getSession();
    if (!session?.user) {
        return { error: "Access denied" };
    }

    const userObjectId = new ObjectId(session.user._id);

    // --- Contact Data ---
    const contactName = formData.get('contactName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const company = formData.get('company') as string;

    // --- Deal Data ---
    const dealName = formData.get('name') as string;
    const dealValue = Number(formData.get('value'));
    const dealStage = formData.get('stage') as string;
    const leadSource = formData.get('leadSource') as string;

    if (!contactName || !email || !dealName || !dealValue || !dealStage) {
        return { error: "Missing required fields for lead/deal creation." };
    }

    try {
        const { db } = await connectToDatabase();
        
        // --- Step 1: Find or Create Account (Company) ---
        let accountId;
        if (company) {
            const accountResult = await db.collection('crm_accounts').findOneAndUpdate(
                { name: company, userId: userObjectId },
                { $setOnInsert: { name: company, userId: userObjectId, createdAt: new Date(), status: 'active' } },
                { upsert: true, returnDocument: 'after' }
            );
            accountId = accountResult?._id;
        }

        // --- Step 2: Find or Create Contact ---
        const newContactData: Partial<CrmContact> = {
            userId: userObjectId,
            name: contactName,
            email: email,
            phone: phone,
            ...(accountId && { accountId: accountId, company: company }),
            status: 'new_lead',
            leadSource: leadSource,
        };
        
        const contactResult = await db.collection('crm_contacts').findOneAndUpdate(
            { email: newContactData.email, userId: userObjectId },
            { 
                $set: { name: newContactData.name, phone: newContactData.phone, accountId: newContactData.accountId, company: newContactData.company },
                $setOnInsert: { ...newContactData, createdAt: new Date() }
            },
            { upsert: true, returnDocument: 'after' }
        );
        
        const contact = contactResult;

        if (!contact) {
            return { error: "Failed to create or find contact." };
        }
        
        const contactId = contact._id;

        // --- Step 3: Create Deal ---
        const user = await db.collection('users').findOne({ _id: userObjectId });
        const stages = getDealStagesForIndustry(user?.crmIndustry);
        const finalStage = dealStage && stages.includes(dealStage) ? dealStage : stages[0] || 'New';

        const newDeal: Omit<CrmDeal, '_id'> = {
            userId: userObjectId,
            name: dealName,
            value: dealValue,
            currency: 'INR',
            stage: finalStage,
            accountId: accountId,
            contactIds: [contactId],
            ownerId: userObjectId,
            leadSource: leadSource,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const dealResult = await db.collection('crm_deals').insertOne(newDeal as CrmDeal);
        const dealId = dealResult.insertedId;

        revalidatePath('/dashboard/crm/deals');
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        return { message: 'Lead and Deal created successfully.', contactId: contactId.toString(), dealId: dealId.toString() };

    } catch (e: any) {
        console.error("Error in addCrmLeadAndDeal:", e);
        return { error: getErrorMessage(e) };
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

export async function updateCrmDealStage(dealId: string, newStage: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(dealId)) {
        return { success: false, error: 'Invalid request.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId), userId: new ObjectId(session.user._id) },
            { $set: { stage: newStage, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Deal not found or access denied.' };
        }
        revalidatePath('/dashboard/crm/deals');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


    
