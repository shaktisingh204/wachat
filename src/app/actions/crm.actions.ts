

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmContact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';

export async function getCrmContacts(
    page: number = 1,
    limit: number = 20,
    query?: string,
    accountId?: string,
    sortBy?: string,
    sortDirection?: 'asc' | 'desc'
): Promise<{ contacts: WithId<CrmContact>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { contacts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmContact> = { userId: userObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { email: queryRegex },
                { company: queryRegex }
            ];
        }
        
        if (accountId && ObjectId.isValid(accountId)) {
            filter.accountId = new ObjectId(accountId);
        }

        const sort: any = {};
        if (sortBy && sortDirection) {
            sort[sortBy] = sortDirection === 'asc' ? 1 : -1;
        } else {
            sort.lastActivity = -1; // Default sort
        }


        const skip = (page - 1) * limit;

        const [contacts, total] = await Promise.all([
            db.collection<CrmContact>('crm_contacts').find(filter).sort(sort).skip(skip).limit(limit).toArray(),
            db.collection('crm_contacts').countDocuments(filter)
        ]);
        
        return {
            contacts: JSON.parse(JSON.stringify(contacts)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM contacts:", e);
        return { contacts: [], total: 0 };
    }
}

export async function getCrmContactById(contactId: string): Promise<WithId<CrmContact> | null> {
    if (!ObjectId.isValid(contactId)) return null;
    
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const contact = await db.collection<CrmContact>('crm_contacts').findOne({ 
            _id: new ObjectId(contactId),
            userId: new ObjectId(session.user._id) 
        });

        return contact ? JSON.parse(JSON.stringify(contact)) : null;
    } catch(e) {
        return null;
    }
}

export async function addCrmContact(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const newContact: Partial<CrmContact> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            company: formData.get('company') as string,
            jobTitle: formData.get('jobTitle') as string,
            status: formData.get('status') as CrmContact['status'],
            leadScore: Number(formData.get('leadScore') || 0),
            createdAt: new Date(),
        };

        const accountId = formData.get('accountId') as string;
        if(accountId && ObjectId.isValid(accountId)) {
            newContact.accountId = new ObjectId(accountId);
        }

        if (!newContact.name || !newContact.email) {
            return { error: 'Name and Email are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_contacts').insertOne(newContact as CrmContact);
        
        revalidatePath('/dashboard/crm/contacts');
        return { message: 'Contact added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmClient(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const { db } = await connectToDatabase();

        const accountResult = await db.collection('crm_accounts').insertOne({
            userId: new ObjectId(session.user._id),
            name: formData.get('businessName') as string,
            industry: formData.get('clientIndustry') as string,
            phone: formData.get('phone') as string,
            createdAt: new Date(),
            status: 'active'
        });

        const newContact: Partial<CrmContact> = {
            userId: new ObjectId(session.user._id),
            accountId: accountResult.insertedId,
            name: formData.get('businessName') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            company: formData.get('businessName') as string,
            status: 'new_lead',
            createdAt: new Date(),
        };
        await db.collection('crm_contacts').insertOne(newContact as CrmContact);

        revalidatePath('/dashboard/crm/sales/clients');
        return { message: 'New client added successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}


export async function importCrmContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    // This action remains as it's more about data import than role management.
    return { error: 'Not yet implemented.'}
}


export async function addCrmNote(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const recordId = formData.get('recordId') as string;
    const recordType = formData.get('recordType') as 'contact' | 'account' | 'deal';
    const content = formData.get('noteContent') as string;
    
    if (!recordId || !ObjectId.isValid(recordId) || !recordType || !content) {
        return { error: "Missing required information for note." };
    }
    
    const collectionMap = {
        contact: 'crm_contacts',
        account: 'crm_accounts',
        deal: 'crm_deals',
    };
    const collectionName = collectionMap[recordType];
    
    try {
        const { db } = await connectToDatabase();
        const newNote = {
            content,
            author: session.user.name,
            createdAt: new Date(),
        };
        await db.collection(collectionName).updateOne(
            { _id: new ObjectId(recordId), userId: new ObjectId(session.user._id) },
            { $push: { notes: { $each: [newNote], $position: 0 } } }
        );
        revalidatePath(`/dashboard/crm/${recordType}s/${recordId}`);
        return { message: "Note added." };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveCrmIndustry(industry: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { crmIndustry: industry } }
        );
        revalidatePath('/dashboard/crm/setup');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function saveCrmProviders(prevState: any, formData: FormData) {
     const session = await getSession();
    if (!session?.user) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        // Placeholder for future provider settings
        
        revalidatePath('/dashboard/crm/settings');
        return { message: 'Provider settings saved successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
