
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmDeal, CrmContact, CrmAccount } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';

export async function createCrmDeal(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const newDeal: Partial<Omit<CrmDeal, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            value: Number(formData.get('value')),
            currency: formData.get('currency') as string,
            stage: formData.get('stage') as string,
            pipelineId: formData.get('pipelineId') as string,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const closeDate = formData.get('closeDate') as string;
        if (closeDate) newDeal.closeDate = new Date(closeDate);
        
        const accountId = formData.get('accountId') as string;
        if (accountId) newDeal.accountId = new ObjectId(accountId);
        
        const contactId = formData.get('contactId') as string;
        if (contactId) newDeal.contactIds = [new ObjectId(contactId)];
        
        const { db } = await connectToDatabase();
        await db.collection('crm_deals').insertOne(newDeal as CrmDeal);
        
        revalidatePath('/dashboard/crm/deals');
        return { message: 'New deal created successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmLeadAndDeal(prevState: any, formData: FormData): Promise<{ message?: string; error?: string, contactId?: string, dealId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const email = (formData.get('email') as string).toLowerCase();
        let contact = await db.collection('crm_contacts').findOne({ email, userId });
        let contactId;

        if (!contact) {
            const newContactData: Partial<CrmContact> = {
                userId, email,
                name: formData.get('contactName') as string,
                phone: formData.get('phone') as string,
                company: formData.get('companyName') as string, // This comes from account
                jobTitle: formData.get('designation') as string,
                status: 'new_lead',
                leadSource: formData.get('leadSource') as string,
                tags: (formData.get('tagIds') as string)?.split(',').filter(Boolean),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const contactResult = await db.collection('crm_contacts').insertOne(newContactData as CrmContact);
            contactId = contactResult.insertedId;
        } else {
            contactId = contact._id;
        }

        const newDeal: Partial<Omit<CrmDeal, '_id'>> = {
            userId,
            name: formData.get('name') as string,
            value: 0, // Default value, can be updated later
            currency: 'INR',
            stage: formData.get('stage') as string,
            pipelineId: formData.get('pipelineId') as string,
            leadSource: formData.get('leadSource') as string,
            description: formData.get('description') as string,
            contactIds: [contactId],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const accountId = formData.get('accountId') as string;
        if(accountId) newDeal.accountId = new ObjectId(accountId);

        const dealResult = await db.collection('crm_deals').insertOne(newDeal as CrmDeal);

        revalidatePath('/dashboard/crm/deals');
        revalidatePath('/dashboard/crm/sales-crm/all-leads');

        return { message: 'New lead and associated deal created successfully.', contactId: contactId.toString(), dealId: dealResult.insertedId.toString() };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getCrmDeals(page = 1, limit = 20, query = ''): Promise<{ deals: WithId<CrmDeal>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { deals: [], total: 0 };
    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;
        const filter: Filter<CrmDeal> = { userId: new ObjectId(session.user._id) };
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        const [deals, total] = await Promise.all([
            db.collection('crm_deals').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_deals').countDocuments(filter),
        ]);

        return {
            deals: JSON.parse(JSON.stringify(deals)),
            total
        };
    } catch (e) {
        return { deals: [], total: 0 };
    }
}

export async function getCrmDealById(dealId: string): Promise<WithId<CrmDeal> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(dealId)) return null;

    try {
        const { db } = await connectToDatabase();
        const deal = await db.collection('crm_deals').findOne({
            _id: new ObjectId(dealId),
            userId: new ObjectId(session.user._id),
        });
        return deal ? JSON.parse(JSON.stringify(deal)) : null;
    } catch (e) {
        return null;
    }
}

export async function updateCrmDealStage(dealId: string, newStage: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(dealId)) return { success: false, error: "Invalid request." };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId), userId: new ObjectId(session.user._id) },
            { $set: { stage: newStage, updatedAt: new Date() } }
        );
        revalidatePath('/dashboard/crm/deals');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
