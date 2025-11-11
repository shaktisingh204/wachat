

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmDeal, CrmContact, CrmAccount, User, CrmTask } from '@/lib/definitions';
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

        const filter: any = { userId: userObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            
            const matchingContacts = await db.collection('crm_contacts').find({ userId: userObjectId, name: queryRegex }).project({ _id: 1 }).toArray();
            const contactIds = matchingContacts.map(c => c._id);
            
            const matchingAccounts = await db.collection('crm_accounts').find({ userId: userObjectId, name: queryRegex }).project({ _id: 1 }).toArray();
            const accountIds = matchingAccounts.map(a => a._id);

            filter.$or = [
                { name: queryRegex },
                { contactIds: { $in: contactIds } },
                { accountId: { $in: accountIds } }
            ];
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

    try {
        const newDeal: Partial<Omit<CrmDeal, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            value: Number(formData.get('value')),
            currency: formData.get('currency') as string,
            stage: formData.get('stage') as string,
            leadSource: formData.get('leadSource') as string,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const accountId = formData.get('accountId') as string;
        if(accountId && ObjectId.isValid(accountId)) newDeal.accountId = new ObjectId(accountId);
        
        const contactId = formData.get('contactId') as string;
        if(contactId && ObjectId.isValid(contactId)) newDeal.contactIds = [new ObjectId(contactId)];
        
        const closeDate = formData.get('closeDate') as string;
        if(closeDate) newDeal.closeDate = new Date(closeDate);
        
        if (!newDeal.name || !newDeal.stage || isNaN(newDeal.value)) {
            return { error: 'Deal Name, Stage, and Value are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_deals').insertOne(newDeal as CrmDeal);
        
        revalidatePath('/dashboard/crm/deals');
        return { message: 'Deal created successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmLeadAndDeal(
    prevState: any, 
    formData: FormData,
    apiUser?: WithId<User>
): Promise<{ message?: string; error?: string, contactId?: string, dealId?: string }> {
    const session = apiUser ? { user: apiUser } : await getSession();
    if (!session?.user) return { error: "Access denied" };

    const { db } = await connectToDatabase();
    
    // --- Contact Handling ---
    const contactName = formData.get('contactName') as string;
    const email = (formData.get('email') as string)?.toLowerCase();
    const phone = formData.get('phone') as string;
    const company = formData.get('company') as string;
    const jobTitle = formData.get('designation') as string;
    const tagIds = (formData.get('tagIds') as string)?.split(',').filter(Boolean);

    if (!contactName || !email) {
        return { error: 'Contact Name and Email are required to create a lead.' };
    }
    
    let contact: WithId<CrmContact> | null = null;
    try {
        const existingContact = await db.collection<CrmContact>('crm_contacts').findOne({ email: email, userId: session.user._id });
        
        if (existingContact) {
            contact = existingContact;
        } else {
            const newContactData: Omit<CrmContact, '_id'> = {
                userId: session.user._id,
                name: contactName,
                email,
                phone,
                company,
                jobTitle,
                status: 'new_lead',
                leadSource: formData.get('leadSource') as string,
                tags: tagIds,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const insertResult = await db.collection('crm_contacts').insertOne(newContactData as any);
            contact = { ...newContactData, _id: insertResult.insertedId };
        }
    } catch(e) {
        console.error("Error in find/create contact for lead:", e);
        return { error: `Database error during contact processing: ${getErrorMessage(e)}` };
    }
    
    if (!contact) {
        return { error: "Failed to create or find contact." };
    }
    
    // --- Deal Handling ---
    try {
        const dealName = formData.get('name') as string;
        const dealValue = Number(formData.get('value'));
        const dealStage = formData.get('stage') as string;

        if (!dealName || isNaN(dealValue) || !dealStage) {
            return { error: "Deal Name, Value, and Stage are required." };
        }

        const newDeal: Partial<Omit<CrmDeal, '_id'>> = {
            userId: session.user._id,
            name: dealName,
            value: dealValue,
            currency: 'INR',
            stage: dealStage,
            contactIds: [contact._id],
            accountId: contact.accountId,
            leadSource: formData.get('leadSource') as string,
            description: formData.get('description') as string,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const dealResult = await db.collection('crm_deals').insertOne(newDeal as any);

        revalidatePath('/dashboard/crm/deals');
        revalidatePath('/dashboard/crm/sales-crm/all-leads');

        return { 
            message: 'Lead and deal created successfully.', 
            contactId: contact._id.toString(),
            dealId: dealResult.insertedId.toString(),
        };

    } catch (e: any) {
         return { error: `Failed to create deal: ${getErrorMessage(e)}` };
    }
}


export async function updateCrmDealStage(dealId: string, newStage: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(dealId)) {
        return { success: false, error: 'Invalid Deal ID.' };
    }
    
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const deal = await db.collection('crm_deals').findOne({ _id: new ObjectId(dealId), userId: new ObjectId(session.user._id) });
        if (!deal) {
            return { success: false, error: 'Deal not found or you do not have permission.' };
        }

        await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId) },
            { $set: { stage: newStage, updatedAt: new Date() } }
        );

        revalidatePath('/dashboard/crm/deals');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
