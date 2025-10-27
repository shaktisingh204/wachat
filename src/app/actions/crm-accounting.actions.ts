
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

    const groupId = formData.get('groupId') as string | null;
    const isEditing = !!groupId;

    try {
        const groupData: Partial<Omit<CrmAccountGroup, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            type: formData.get('type') as CrmAccountGroup['type'],
            category: formData.get('category') as string,
        };

        if (!groupData.name || !groupData.type || !groupData.category) {
            return { error: 'All fields are required.' };
        }

        const { db } = await connectToDatabase();
        
        const existingFilter: Filter<CrmAccountGroup> = {
            userId: groupData.userId,
            name: groupData.name,
        };
        if (isEditing) {
            existingFilter._id = { $ne: new ObjectId(groupId!) };
        }
        const existing = await db.collection('crm_account_groups').findOne(existingFilter);

        if (existing) {
            return { error: `An account group named "${groupData.name}" already exists.`};
        }

        if (isEditing) {
            await db.collection('crm_account_groups').updateOne(
                { _id: new ObjectId(groupId!) },
                { $set: groupData }
            );
        } else {
            await db.collection('crm_account_groups').insertOne({
                ...groupData,
                createdAt: new Date()
            } as CrmAccountGroup);
        }
        
        revalidatePath('/dashboard/crm/accounting/groups');
        return { message: 'Account group saved successfully.' };
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
