
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmAccountGroup, CrmChartOfAccount } from '@/lib/definitions';
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
        if (isEditing && ObjectId.isValid(groupId)) {
            existingFilter._id = { $ne: new ObjectId(groupId!) };
        }
        const existing = await db.collection('crm_account_groups').findOne(existingFilter);

        if (existing) {
            return { error: `An account group named "${groupData.name}" already exists.`};
        }

        if (isEditing && ObjectId.isValid(groupId)) {
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


export async function getCrmChartOfAccounts(): Promise<WithId<any>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const accounts = await db.collection<CrmChartOfAccount>('crm_chart_of_accounts')
            .aggregate([
                { $match: { userId: new ObjectId(session.user._id) } },
                { $sort: { name: 1 } },
                {
                    $lookup: {
                        from: 'crm_account_groups',
                        localField: 'accountGroupId',
                        foreignField: '_id',
                        as: 'accountGroupInfo'
                    }
                },
                { $unwind: { path: '$accountGroupInfo', preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        accountGroupName: '$accountGroupInfo.name',
                        accountGroupCategory: '$accountGroupInfo.category',
                        accountGroupType: '$accountGroupInfo.type',
                    }
                },
                { $project: { accountGroupInfo: 0 } }
            ]).toArray();
        return JSON.parse(JSON.stringify(accounts));
    } catch (e) {
        console.error("Failed to fetch Chart of Accounts:", e);
        return [];
    }
}

export async function getCrmChartOfAccountById(accountId: string): Promise<WithId<any> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(accountId)) return null;

    try {
        const { db } = await connectToDatabase();
        const accounts = await db.collection<CrmChartOfAccount>('crm_chart_of_accounts')
            .aggregate([
                { $match: { _id: new ObjectId(accountId), userId: new ObjectId(session.user._id) } },
                { $limit: 1 },
                {
                    $lookup: {
                        from: 'crm_account_groups',
                        localField: 'accountGroupId',
                        foreignField: '_id',
                        as: 'accountGroupInfo'
                    }
                },
                { $unwind: { path: '$accountGroupInfo', preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        accountGroupName: '$accountGroupInfo.name',
                        accountGroupCategory: '$accountGroupInfo.category',
                        accountGroupType: '$accountGroupInfo.type',
                    }
                },
                { $project: { accountGroupInfo: 0 } }
            ]).toArray();

        if (accounts.length === 0) return null;
        return JSON.parse(JSON.stringify(accounts[0]));
    } catch (e) {
        console.error("Failed to fetch Chart of Account by ID:", e);
        return null;
    }
}

export async function saveCrmChartOfAccount(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const accountId = formData.get('accountId') as string | null;
    const isEditing = !!accountId;

    try {
        const accountData: Partial<Omit<CrmChartOfAccount, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            accountGroupId: new ObjectId(formData.get('accountGroupId') as string),
            openingBalance: Number(formData.get('openingBalance')),
            balanceType: formData.get('balanceType') as 'Cr' | 'Dr',
            currency: formData.get('currency') as string,
            description: formData.get('description') as string | undefined,
            status: formData.get('status') === 'on' ? 'Active' : 'Inactive',
        };

        if (!accountData.name || !accountData.accountGroupId) {
            return { error: 'Account Name and Group are required.' };
        }

        const { db } = await connectToDatabase();
        
        if (isEditing && ObjectId.isValid(accountId)) {
            await db.collection('crm_chart_of_accounts').updateOne(
                { _id: new ObjectId(accountId!) },
                { $set: accountData }
            );
        } else {
            await db.collection('crm_chart_of_accounts').insertOne({
                ...accountData,
                createdAt: new Date()
            } as CrmChartOfAccount);
        }
        
        revalidatePath('/dashboard/crm/accounting/charts');
        return { message: 'Account saved successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmChartOfAccount(accountId: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    if (!accountId || !ObjectId.isValid(accountId)) {
        return { success: false, error: 'Invalid Account ID' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_chart_of_accounts').deleteOne({
            _id: new ObjectId(accountId),
            userId: new ObjectId(session.user._id)
        });
        revalidatePath('/dashboard/crm/accounting/charts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
