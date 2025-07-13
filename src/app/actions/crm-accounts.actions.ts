

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmAccount } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmAccounts(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ accounts: WithId<CrmAccount>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { accounts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmAccount> = { userId: userObjectId };
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
        const newAccount: Omit<CrmAccount, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            industry: formData.get('industry') as string,
            website: formData.get('website') as string,
            phone: formData.get('phone') as string,
            notes: [],
            createdAt: new Date(),
        };

        const { db } = await connectToDatabase();
        await db.collection('crm_accounts').insertOne(newAccount as any);
        
        revalidatePath('/dashboard/crm/accounts');
        return { message: 'Account added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}
