
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmDeal, CrmContact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';


export async function getCrmDeals(page: number = 1, limit: number = 20, query?: string): Promise<{ deals: WithId<CrmDeal>[], total: number }> {
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
    } catch(e) {
        return null;
    }
}

export async function createCrmDeal(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const dealSchema = z.object({
        name: z.string().min(1, 'Deal name is required.'),
        value: z.coerce.number().min(0, 'Value must be a positive number.'),
        currency: z.string(),
        stage: z.string(),
        closeDate: z.string().optional(),
        accountId: z.string().optional(),
        contactId: z.string().optional(),
    });
    
    const validatedFields = dealSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { error: validatedFields.error.flatten().fieldErrors[Object.keys(validatedFields.error.flatten().fieldErrors)[0]][0] };
    }

    try {
        const newDeal: Partial<CrmDeal> = {
            userId: new ObjectId(session.user._id),
            name: validatedFields.data.name,
            value: validatedFields.data.value,
            currency: validatedFields.data.currency,
            stage: validatedFields.data.stage,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (validatedFields.data.closeDate) newDeal.closeDate = new Date(validatedFields.data.closeDate);
        if (validatedFields.data.accountId) newDeal.accountId = new ObjectId(validatedFields.data.accountId);
        if (validatedFields.data.contactId) newDeal.contactIds = [new ObjectId(validatedFields.data.contactId)];

        const { db } = await connectToDatabase();
        await db.collection('crm_deals').insertOne(newDeal as CrmDeal);
        
        revalidatePath('/dashboard/crm/deals');
        return { message: 'Deal created successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmLeadAndDeal(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, contactId?: string, dealId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const data = Object.fromEntries(formData.entries());

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        let accountId: ObjectId | undefined;
        if(data.accountId) {
             accountId = new ObjectId(data.accountId as string);
        } else if (data.company) {
             const account = await db.collection('crm_accounts').findOneAndUpdate(
                { userId, name: data.company as string },
                { $setOnInsert: { userId, name: data.company as string, createdAt: new Date() } },
                { upsert: true, returnDocument: 'after' }
            );
            if(account) accountId = account._id;
        }

        const contactResult = await db.collection('crm_contacts').findOneAndUpdate(
            { userId, email: data.email as string },
            { $setOnInsert: { 
                userId, 
                name: data.contactName as string, 
                email: data.email as string, 
                phone: data.phone as string,
                company: data.company as string,
                jobTitle: data.designation as string,
                leadSource: data.leadSource as string,
                accountId,
                status: 'new_lead',
                createdAt: new Date()
            }},
            { upsert: true, returnDocument: 'after' }
        );
        const contactId = contactResult?._id;
        if (!contactId) { throw new Error('Failed to create or find contact.'); }
        
        const dealResult = await db.collection('crm_deals').insertOne({
            userId,
            name: data.name as string,
            value: Number(data.dealValue) || 0,
            currency: 'INR',
            stage: data.stage as string,
            contactIds: [contactId],
            accountId: accountId,
            createdAt: new Date(),
            updatedAt: new Date()
        } as CrmDeal);

        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        revalidatePath('/dashboard/crm/deals');
        
        return { 
            message: 'Lead and deal created successfully.',
            contactId: contactId.toString(),
            dealId: dealResult.insertedId.toString()
        };

    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}


export async function updateCrmDeal(prevState: any, formData: FormData): Promise<{ message?: string; error?: string, dealId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied." };

    const dealId = formData.get('dealId') as string;
    if (!dealId || !ObjectId.isValid(dealId)) {
        return { error: 'Invalid Deal ID.' };
    }

    try {
        const updateData: Partial<CrmDeal> = {
            name: formData.get('name') as string,
            value: Number(formData.get('value')),
            stage: formData.get('stage') as string,
            updatedAt: new Date(),
        };
        const closeDate = formData.get('closeDate') as string;
        if (closeDate) updateData.closeDate = new Date(closeDate);
        
        const { db } = await connectToDatabase();
        await db.collection('crm_deals').updateOne({ _id: new ObjectId(dealId) }, { $set: updateData });

        revalidatePath(`/dashboard/crm/deals/${dealId}`);
        revalidatePath('/dashboard/crm/deals');
        return { message: 'Deal updated.', dealId: dealId };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateCrmDealStage(dealId: string, newStage: string): Promise<{ success: boolean, error?: string }> {
    if (!ObjectId.isValid(dealId)) return { success: false, error: 'Invalid Deal ID' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId), userId: new ObjectId(session.user._id) },
            { $set: { stage: newStage, updatedAt: new Date() } }
        );
        revalidatePath('/dashboard/crm/deals');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: 'Failed to update deal stage.' };
    }
}

