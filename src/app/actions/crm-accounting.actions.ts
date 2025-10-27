
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmAccountGroup } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmAccountGroups(): Promise<WithId<CrmAccountGroup>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const groups = await db.collection<CrmAccountGroup>('crm_account_groups')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(groups));
    } catch (e) {
        console.error("Failed to fetch CRM Account Groups:", e);
        return [];
    }
}

export async function saveCrmAccountGroup(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const newGroup: Omit<CrmAccountGroup, '_id' | 'createdAt'> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            type: formData.get('type') as CrmAccountGroup['type'],
            category: formData.get('category') as string,
        };

        if (!newGroup.name || !newGroup.type || !newGroup.category) {
            return { error: 'All fields are required.' };
        }

        const { db } = await connectToDatabase();
        
        const existing = await db.collection('crm_account_groups').findOne({
            userId: newGroup.userId,
            name: newGroup.name,
        });

        if (existing) {
            return { error: `An account group named "${newGroup.name}" already exists.`};
        }

        await db.collection('crm_account_groups').insertOne({
            ...newGroup,
            createdAt: new Date()
        } as CrmAccountGroup);
        
        revalidatePath('/dashboard/crm/accounting/groups');
        return { message: 'Account group created successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmAccountGroup(groupId: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    if (!groupId || !ObjectId.isValid(groupId)) {
        return { success: false, error: 'Invalid Group ID' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_account_groups').deleteOne({
            _id: new ObjectId(groupId),
            userId: new ObjectId(session.user._id)
        });
        revalidatePath('/dashboard/crm/accounting/groups');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
