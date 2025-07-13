
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { CrmAccount } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmAccounts(
    projectId: string,
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ accounts: WithId<CrmAccount>[], total: number }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { accounts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        
        const filter: Filter<CrmAccount> = { projectId: projectObjectId };
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

    try {
        const { db } = await connectToDatabase();
        const account = await db.collection<CrmAccount>('crm_accounts').findOne({ _id: new ObjectId(accountId) });
        if (!account) return null;
        
        const hasAccess = await getProjectById(account.projectId.toString());
        if (!hasAccess) return null;

        return JSON.parse(JSON.stringify(account));
    } catch(e) {
        return null;
    }
}

export async function addCrmAccount(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const project = await getProjectById(projectId);
    if (!project) return { error: "Access denied" };

    try {
        const newAccount: Omit<CrmAccount, '_id'> = {
            projectId: new ObjectId(projectId),
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

export async function addCrmAccountNote(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const accountId = formData.get('accountId') as string;
    const content = formData.get('noteContent') as string;

    if (!accountId || !content) {
        return { error: 'Note content cannot be empty.' };
    }
    
    const account = await getCrmAccountById(accountId);
    if (!account) return { error: "Account not found" };

    const note = {
        content,
        author: "Admin User", // Placeholder
        createdAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_accounts').updateOne(
            { _id: new ObjectId(accountId) },
            { $push: { notes: { $each: [note], $position: 0 } } }
        );
        revalidatePath(`/dashboard/crm/accounts/${accountId}`);
        return { message: 'Note added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}
