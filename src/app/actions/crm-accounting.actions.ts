

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmAccountGroup, CrmChartOfAccount, CrmVoucherEntry } from '@/lib/definitions';
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

export async function getVoucherEntriesForAccount(accountId: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(accountId)) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const accountObjectId = new ObjectId(accountId);

        const dateFilter = (startDate && endDate) ? { date: { $gte: startDate, $lte: endDate } } : {};
        const filter = {
            userId,
            ...dateFilter,
            $or: [
                { 'debitEntries.accountId': accountObjectId },
                { 'creditEntries.accountId': accountObjectId }
            ]
        };

        const entries = await db.collection<CrmVoucherEntry>('crm_voucher_entries')
            .find(filter)
            .sort({ date: 1 })
            .toArray();

        return JSON.parse(JSON.stringify(entries));
    } catch(e) {
        console.error("Failed to fetch voucher entries for account:", e);
        return [];
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
                { _id: new ObjectId(accountId!), userId: new ObjectId(session.user._id) },
                { $set: accountData }
            );
        } else {
            await db.collection('crm_chart_of_accounts').insertOne({
                ...accountData,
                createdAt: new Date()
            } as CrmChartOfAccount);
        }
        
        revalidatePath('/dashboard/crm/accounting/charts');
        revalidatePath(`/dashboard/crm/accounting/charts/${accountId}`);
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

export async function generateBalanceSheetData() {
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const accounts = await db.collection('crm_chart_of_accounts').aggregate([
            { $match: { userId } },
            { $lookup: { from: 'crm_account_groups', localField: 'accountGroupId', foreignField: '_id', as: 'group' } },
            { $unwind: '$group' }
        ]).toArray();

        const voucherEntries = await db.collection('crm_voucher_entries').find({ userId }).toArray();
        
        const accountBalances: { [key: string]: number } = {};

        for (const account of accounts) {
            let balance = account.balanceType === 'Cr' ? -account.openingBalance : account.openingBalance;
            
            for (const entry of voucherEntries) {
                for (const debit of entry.debitEntries) {
                    if (debit.accountId.equals(account._id)) {
                        balance += debit.amount;
                    }
                }
                for (const credit of entry.creditEntries) {
                    if (credit.accountId.equals(account._id)) {
                        balance -= credit.amount;
                    }
                }
            }
            accountBalances[account._id.toString()] = balance;
        }
        
        let totalAssets = 0, totalLiabilities = 0, totalCapital = 0;
        
        for (const account of accounts) {
            const balance = accountBalances[account._id.toString()];
            if (account.group.type === 'Asset') totalAssets += balance;
            if (account.group.type === 'Liability') totalLiabilities += -balance; // Liabilities are credits, so flip sign
            if (account.group.type === 'Capital') totalCapital += -balance; // Capital is credit, flip sign
        }

        const debtToEquity = totalCapital > 0 ? (totalLiabilities / totalCapital) * 100 : 0;

        return {
            summary: {
                totalAssets,
                totalLiabilities,
                totalCapital,
                debtToEquity,
            },
            entries: [
                { account: 'Asset', amount: totalAssets, isMain: true },
                { account: 'Liablities and equities', amount: totalLiabilities + totalCapital, isMain: true },
                { account: 'Liability', amount: totalLiabilities, isMain: false, isSub: true },
                { account: 'Capital', amount: totalCapital, isMain: false, isSub: true },
            ]
        };
    } catch (e) {
        console.error("Failed to generate balance sheet data:", e);
        return null;
    }
}

export async function generateTrialBalanceData(startDate?: Date, endDate?: Date) {
    const session = await getSession();
    if (!session?.user) return null;
    
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const dateFilter = (startDate && endDate) ? { date: { $gte: startDate, $lte: endDate } } : {};
        
        const accounts = await db.collection('crm_chart_of_accounts').find({ userId }).toArray();
        const voucherEntries = await db.collection('crm_voucher_entries').find({ userId, ...dateFilter }).toArray();
        
        const data = accounts.map(account => {
            const openingBalance = account.balanceType === 'Cr' ? -account.openingBalance : account.openingBalance;
            
            const totalDebit = voucherEntries.reduce((sum, entry) =>
                sum + entry.debitEntries.reduce((entrySum, debit) =>
                    debit.accountId.equals(account._id) ? entrySum + debit.amount : entrySum, 0), 0);
            
            const totalCredit = voucherEntries.reduce((sum, entry) =>
                sum + entry.creditEntries.reduce((entrySum, credit) =>
                    credit.accountId.equals(account._id) ? entrySum + credit.amount : entrySum, 0), 0);
                
            const closingBalance = openingBalance + totalDebit - totalCredit;
            
            return {
                accountId: account._id.toString(),
                accountName: account.name,
                openingBalance: Math.abs(openingBalance),
                openingBalanceType: openingBalance >= 0 ? 'Dr' : 'Cr' as 'Dr' | 'Cr',
                totalDebit,
                totalCredit,
                closingBalance: Math.abs(closingBalance),
                closingBalanceType: closingBalance >= 0 ? 'Dr' : 'Cr' as 'Dr' | 'Cr',
            }
        });

        const totals = data.reduce((acc, curr) => {
            acc.totalOpening += (curr.openingBalanceType === 'Dr' ? curr.openingBalance : -curr.openingBalance);
            acc.totalDebit += curr.totalDebit;
            acc.totalCredit += curr.totalCredit;
            acc.totalClosing += (curr.closingBalanceType === 'Dr' ? curr.closingBalance : -curr.closingBalance);
            return acc;
        }, { totalOpening: 0, totalDebit: 0, totalCredit: 0, totalClosing: 0 });
        
        return { data, totals };
        
    } catch (e) {
        console.error("Failed to generate trial balance data:", e);
        return null;
    }
}

export async function generateProfitAndLossData(startDate?: Date, endDate?: Date) {
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const dateFilter = (startDate && endDate) ? { date: { $gte: startDate, $lte: endDate } } : {};
        const filter = { userId, ...dateFilter };

        const accounts = await db.collection('crm_chart_of_accounts').aggregate([
            { $match: { userId } },
            { $lookup: { from: 'crm_account_groups', localField: 'accountGroupId', foreignField: '_id', as: 'group' } },
            { $unwind: '$group' }
        ]).toArray();

        const voucherEntries = await db.collection('crm_voucher_entries').find(filter).toArray();

        let totalIncome = 0;
        let totalCogs = 0;
        let totalExpense = 0;

        for (const account of accounts) {
            const closingBalance = voucherEntries.reduce((balance, entry) => {
                const debit = entry.debitEntries.reduce((sum, d) => d.accountId.equals(account._id) ? sum + d.amount : sum, 0);
                const credit = entry.creditEntries.reduce((sum, c) => c.accountId.equals(account._id) ? sum + c.amount : sum, 0);
                return balance + debit - credit;
            }, 0);

            if (account.group.type === 'Income') totalIncome += -closingBalance; // Incomes are credits
            if (account.group.category === 'Cost_Of_Goods_Sold' || account.group.category === 'Purchase_Accounts') totalCogs += closingBalance;
            if (account.group.type === 'Expense' && account.group.category !== 'Cost_Of_Goods_Sold' && account.group.category !== 'Purchase_Accounts') totalExpense += closingBalance;
        }

        const grossProfit = totalIncome - totalCogs;
        const netProfit = grossProfit - totalExpense;

        return {
            summary: {
                totalIncome,
                totalCogs,
                totalExpense,
                grossProfit,
                netProfit,
            },
            entries: [
                { account: 'Income', amount: totalIncome },
                { account: 'Cost of Goods Sold', amount: totalCogs },
                { account: 'Gross Profit', amount: grossProfit, isMain: true },
                { account: 'Expense', amount: totalExpense },
                { account: 'Net Profit', amount: netProfit, isMain: true },
            ]
        };

    } catch (e) {
        console.error("Failed to generate P&L data:", e);
        return null;
    }
}


export async function generateIncomeStatementData(startDate?: Date, endDate?: Date) {
    const session = await getSession();
    if (!session?.user) return { incomeData: [], expenseData: [], netSurplus: 0 };
    
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const dateFilter = (startDate && endDate) ? { date: { $gte: startDate, $lte: endDate } } : {};
    const filter = { userId, ...dateFilter };

    const accounts = await db.collection<WithId<CrmChartOfAccount>>('crm_chart_of_accounts').find({ userId }).toArray();
    const groups = await db.collection<WithId<CrmAccountGroup>>('crm_account_groups').find({ userId, type: { $in: ['Income', 'Expense'] } }).toArray();
    const voucherEntries = await db.collection<WithId<CrmVoucherEntry>>('crm_voucher_entries').find(filter).toArray();

    const accountBalances: Record<string, number> = {};

    for (const account of accounts) {
        let balance = 0;
        voucherEntries.forEach(entry => {
            entry.debitEntries.forEach(debit => {
                if (debit.accountId.equals(account._id)) balance += debit.amount;
            });
            entry.creditEntries.forEach(credit => {
                if (credit.accountId.equals(account._id)) balance -= credit.amount;
            });
        });
        accountBalances[account._id.toString()] = balance;
    }
    
    const processGroup = (type: 'Income' | 'Expense') => {
        return groups.filter(g => g.type === type).map(group => {
            const groupAccounts = accounts.filter(a => a.accountGroupId.equals(group._id));
            const groupTotal = groupAccounts.reduce((sum, acc) => sum + (accountBalances[acc._id.toString()] || 0), 0);

            return {
                groupName: group.name,
                category: group.category,
                accounts: groupAccounts.map(acc => ({
                    accountName: acc.name,
                    balance: accountBalances[acc._id.toString()] || 0
                })),
                total: groupTotal
            };
        }).filter(g => g.accounts.length > 0 || g.total !== 0);
    };

    const incomeData = processGroup('Income');
    const expenseData = processGroup('Expense');

    const totalIncome = incomeData.reduce((sum, group) => sum + group.total, 0);
    const totalExpense = expenseData.reduce((sum, group) => sum + group.total, 0);
    const netSurplus = -totalIncome - totalExpense; // Incomes are credits (negative)

    return { incomeData, expenseData, netSurplus };
}
