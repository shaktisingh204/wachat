'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmAccount } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmAccounts(
    page: number = 1,
    limit: number = 20,
    query?: string,
    status: 'active' | 'archived' | 'all' = 'active'
): Promise<{ accounts: WithId<CrmAccount>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { accounts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmAccount> = { userId: userObjectId };
        if (status === 'active') {
            filter.status = { $ne: 'archived' };
        } else if (status === 'archived') {
            filter.status = 'archived';
        }

        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { industry: queryRegex },
                { website: queryRegex }
            ];
        }

        const skip = (page - 1) * limit;

        const [accounts, total] = await Promise.all([
            db.collection<CrmAccount>('crm_accounts').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_accounts').countDocuments(filter)
        ]);

        return {
            accounts: JSON.parse(JSON.stringify(accounts)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM accounts:", e);
        return { accounts: [], total: 0 };
    }
}

export async function getCrmAccountById(accountId: string): Promise<WithId<CrmAccount> | null> {
    if (!ObjectId.isValid(accountId)) return null;
    
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const account = await db.collection<CrmAccount>('crm_accounts').findOne({ 
            _id: new ObjectId(accountId),
            userId: new ObjectId(session.user._id) 
        });

        return account ? JSON.parse(JSON.stringify(account)) : null;
    } catch(e) {
        return null;
    }
}

export async function addCrmAccount(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const newAccount: Partial<CrmAccount> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            industry: formData.get('industry') as string | undefined,
            website: formData.get('website') as string | undefined,
            phone: formData.get('phone') as string | undefined,
            notes: [],
            createdAt: new Date(),
            status: 'active'
        };

        if (!newAccount.name) {
            return { error: 'Company Name is required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_accounts').insertOne(newAccount as CrmAccount);
        
        revalidatePath('/dashboard/crm/accounts');
        return { message: 'Account added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateCrmAccount(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, accountId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };
    
    const accountId = formData.get('accountId') as string;
    if (!accountId || !ObjectId.isValid(accountId)) {
        return { error: 'Invalid Account ID.' };
    }

    try {
        const accountUpdates: Partial<CrmAccount> = {
            name: formData.get('name') as string,
            industry: formData.get('industry') as string | undefined,
            website: formData.get('website') as string | undefined,
            phone: formData.get('phone') as string | undefined,
            updatedAt: new Date(),
        };

        if (!accountUpdates.name) {
            return { error: 'Company Name is required.' };
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('crm_accounts').updateOne(
            { _id: new ObjectId(accountId), userId: new ObjectId(session.user._id) },
            { $set: accountUpdates }
        );

        if (result.matchedCount === 0) {
            return { error: 'Account not found or access denied.' };
        }
        
        revalidatePath(`/dashboard/crm/accounts/${accountId}`);
        revalidatePath('/dashboard/crm/accounts');
        revalidatePath('/dashboard/crm/sales/clients');
        return { message: 'Account updated successfully.', accountId };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function archiveCrmAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    if (!accountId || !ObjectId.isValid(accountId)) {
        return { success: false, error: 'Invalid Account ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_accounts').updateOne(
            { _id: new ObjectId(accountId), userId: new ObjectId(session.user._id) },
            { $set: { status: 'archived', updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Account not found or access denied.' };
        }
        
        revalidatePath('/dashboard/crm/accounts');
        revalidatePath('/dashboard/crm/sales/clients');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function unarchiveCrmAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    if (!accountId || !ObjectId.isValid(accountId)) {
        return { success: false, error: 'Invalid Account ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_accounts').updateOne(
            { _id: new ObjectId(accountId), userId: new ObjectId(session.user._id) },
            { $set: { status: 'active', updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Account not found or access denied.' };
        }

        revalidatePath('/dashboard/crm/accounts');
        revalidatePath('/dashboard/crm/sales/clients');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}