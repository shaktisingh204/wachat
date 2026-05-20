'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmAccountGroup, CrmChartOfAccount, CrmVoucherEntry } from '@/lib/definitions';
import { coerceFiniteMoney } from '@/lib/crm/number-safety';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmChartOfAccountsApi } from '@/lib/rust-client/crm-chart-of-accounts';
import { crmAccountGroupsApi } from '@/lib/rust-client/crm-account-groups';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Account Group: per-id getter (used by group detail / inline editing) ── */

export async function getCrmAccountGroupById(groupId: string): Promise<WithId<CrmAccountGroup> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(groupId)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmAccountGroupsApi.getById(groupId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getCrmAccountGroupById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'account_group',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const group = await db.collection<CrmAccountGroup>('crm_account_groups').findOne({
            _id: new ObjectId(groupId),
            userId: new ObjectId(session.user._id),
        });
        return group ? JSON.parse(JSON.stringify(group)) : null;
    } catch (e) {
        console.error('Failed to fetch account group by ID:', e);
        return null;
    }
}

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

    const guard = await requirePermission('crm_account_group', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

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
        
        const existingFilter: any = {
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

        let savedId: string;
        if (isEditing && ObjectId.isValid(groupId)) {
            await db.collection('crm_account_groups').updateOne(
                { _id: new ObjectId(groupId!) },
                { $set: groupData }
            );
            savedId = groupId!;
        } else {
            const result = await db.collection('crm_account_groups').insertOne({
                ...groupData,
                createdAt: new Date()
            } as CrmAccountGroup);
            savedId = result.insertedId.toString();
        }

        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: isEditing ? 'update' : 'create',
            entityKind: 'account_group',
            entityId: savedId,
            reason: groupData.name,
        });

        revalidatePath('/dashboard/crm/accounting/groups');
        revalidatePath('/dashboard/crm/accounting/charts');
        return { message: 'Account group saved successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getCrmAccountGroupsWithCounts(): Promise<WithId<any>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const groups = await db.collection<CrmAccountGroup>('crm_account_groups')
            .aggregate([
                { $match: { userId } },
                { $sort: { type: 1, name: 1 } },
                {
                    $lookup: {
                        from: 'crm_chart_of_accounts',
                        let: { gid: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$accountGroupId', '$$gid'] } } },
                            { $count: 'n' },
                        ],
                        as: 'accountCount',
                    },
                },
                {
                    $addFields: {
                        accountCount: { $ifNull: [{ $arrayElemAt: ['$accountCount.n', 0] }, 0] },
                    },
                },
            ])
            .toArray();
        return JSON.parse(JSON.stringify(groups));
    } catch (e) {
        console.error('Failed to fetch account groups with counts:', e);
        return [];
    }
}

export async function deleteCrmAccountGroup(groupId: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    if (!groupId || !ObjectId.isValid(groupId)) {
        return { success: false, error: 'Invalid Group ID' };
    }

    const guard = await requirePermission('crm_account_group', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_account_groups').deleteOne({
            _id: new ObjectId(groupId),
            userId: new ObjectId(session.user._id)
        });
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'delete',
            entityKind: 'account_group',
            entityId: groupId,
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

    if (useRustCrm()) {
        try {
            const doc = await crmChartOfAccountsApi.getById(accountId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getCrmChartOfAccountById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'chart_of_account',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

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

    const guard = await requirePermission('crm_chart_of_account', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    try {
        const accountData: Partial<Omit<CrmChartOfAccount, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            accountGroupId: new ObjectId(formData.get('accountGroupId') as string),
            openingBalance: coerceFiniteMoney(formData.get('openingBalance')),
            balanceType: formData.get('balanceType') as 'Cr' | 'Dr',
            currency: formData.get('currency') as string,
            description: formData.get('description') as string | undefined,
            status: formData.get('status') === 'on' ? 'Active' : 'Inactive',
        };

        if (!accountData.name || !accountData.accountGroupId) {
            return { error: 'Account Name and Group are required.' };
        }

        const { db } = await connectToDatabase();
        
        let savedId: string;
        if (isEditing && ObjectId.isValid(accountId)) {
            await db.collection('crm_chart_of_accounts').updateOne(
                { _id: new ObjectId(accountId!), userId: new ObjectId(session.user._id) },
                { $set: accountData }
            );
            savedId = accountId!;
        } else {
            const result = await db.collection('crm_chart_of_accounts').insertOne({
                ...accountData,
                createdAt: new Date()
            } as CrmChartOfAccount);
            savedId = result.insertedId.toString();
        }

        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: isEditing ? 'update' : 'create',
            entityKind: 'chart_of_account',
            entityId: savedId,
            reason: accountData.name,
        });

        revalidatePath('/dashboard/crm/accounting/charts');
        revalidatePath(`/dashboard/crm/accounting/charts/${savedId}`);
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

    const guard = await requirePermission('crm_chart_of_account', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_chart_of_accounts').deleteOne({
            _id: new ObjectId(accountId),
            userId: new ObjectId(session.user._id)
        });
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'delete',
            entityKind: 'chart_of_account',
            entityId: accountId,
        });
        revalidatePath('/dashboard/crm/accounting/charts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Bulk delete + archive (used by CoA bulk bar) ─────────────────────── */

export async function bulkUpdateCrmChartOfAccounts(
    ids: string[],
    op: 'archive' | 'activate' | 'delete'
): Promise<{ success: boolean; updated?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const oids = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (oids.length === 0) return { success: false, error: 'No valid IDs supplied' };

    try {
        const { db } = await connectToDatabase();
        const filter = { _id: { $in: oids }, userId: new ObjectId(session.user._id) };
        let updated = 0;
        if (op === 'delete') {
            const r = await db.collection('crm_chart_of_accounts').deleteMany(filter);
            updated = r.deletedCount ?? 0;
        } else {
            const r = await db
                .collection('crm_chart_of_accounts')
                .updateMany(filter, { $set: { status: op === 'activate' ? 'Active' : 'Inactive' } });
            updated = r.modifiedCount ?? 0;
        }

        for (const id of ids) {
            await writeAuditEntry({
                tenantUserId: session.user._id,
                action: op === 'delete' ? 'delete' : op === 'archive' ? 'archive' : 'restore',
                entityKind: 'chart_of_account',
                entityId: id,
                reason: 'bulk',
            });
        }

        revalidatePath('/dashboard/crm/accounting/charts');
        return { success: true, updated };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Computed CoA: list with current balance (cheap, single pass) ──────── */

export async function getCrmChartOfAccountsWithBalances(): Promise<WithId<any>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const [accounts, vouchers] = await Promise.all([
            db
                .collection<CrmChartOfAccount>('crm_chart_of_accounts')
                .aggregate([
                    { $match: { userId } },
                    { $sort: { name: 1 } },
                    {
                        $lookup: {
                            from: 'crm_account_groups',
                            localField: 'accountGroupId',
                            foreignField: '_id',
                            as: 'accountGroupInfo',
                        },
                    },
                    { $unwind: { path: '$accountGroupInfo', preserveNullAndEmptyArrays: true } },
                    {
                        $addFields: {
                            accountGroupName: '$accountGroupInfo.name',
                            accountGroupCategory: '$accountGroupInfo.category',
                            accountGroupType: '$accountGroupInfo.type',
                        },
                    },
                    { $project: { accountGroupInfo: 0 } },
                ])
                .toArray(),
            db.collection<CrmVoucherEntry>('crm_voucher_entries').find({ userId }).toArray(),
        ]);

        // Build O(1) account → balance map in a single pass over voucher entries.
        const deltas = new Map<string, number>();
        for (const v of vouchers) {
            for (const d of v.debitEntries || []) {
                const k = d.accountId?.toString();
                if (!k) continue;
                deltas.set(k, (deltas.get(k) ?? 0) + (d.amount || 0));
            }
            for (const c of v.creditEntries || []) {
                const k = c.accountId?.toString();
                if (!k) continue;
                deltas.set(k, (deltas.get(k) ?? 0) - (c.amount || 0));
            }
        }

        for (const a of accounts) {
            const opening = a.balanceType === 'Cr' ? -(a.openingBalance || 0) : (a.openingBalance || 0);
            const delta = deltas.get(a._id.toString()) ?? 0;
            const closing = opening + delta;
            (a as any).currentBalance = Math.abs(closing);
            (a as any).currentBalanceType = closing >= 0 ? 'Dr' : 'Cr';
        }

        return JSON.parse(JSON.stringify(accounts));
    } catch (e) {
        console.error('Failed to fetch CoA with balances:', e);
        return [];
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
            
            const totalDebit = voucherEntries.reduce((sum: number, entry: any) =>
                sum + entry.debitEntries.reduce((entrySum: number, debit: any) =>
                    debit.accountId.equals(account._id) ? entrySum + debit.amount : entrySum, 0), 0);

            const totalCredit = voucherEntries.reduce((sum: number, entry: any) =>
                sum + entry.creditEntries.reduce((entrySum: number, credit: any) =>
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
            const closingBalance = voucherEntries.reduce((balance: number, entry: any) => {
                const debit = entry.debitEntries.reduce((sum: number, d: any) => d.accountId.equals(account._id) ? sum + d.amount : sum, 0);
                const credit = entry.creditEntries.reduce((sum: number, c: any) => c.accountId.equals(account._id) ? sum + c.amount : sum, 0);
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

/* ─── Bulk delete: account groups ──────────────────────────────── */

export async function bulkDeleteCrmAccountGroups(
  ids: string[],
): Promise<{ deleted: number; failed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { deleted: 0, failed: ids.length, error: 'Access denied' };

  const oids = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  if (oids.length === 0) return { deleted: 0, failed: ids.length, error: 'No valid IDs' };

  try {
    const { db } = await connectToDatabase();
    const r = await db.collection('crm_account_groups').deleteMany({
      _id: { $in: oids },
      userId: new ObjectId(session.user._id),
    });
    for (const id of ids) {
      await writeAuditEntry({
        tenantUserId: session.user._id,
        action: 'delete',
        entityKind: 'account_group',
        entityId: id,
        reason: 'bulk',
      });
    }
    revalidatePath('/dashboard/crm/accounting/groups');
    const deleted = r.deletedCount ?? 0;
    return { deleted, failed: Math.max(0, ids.length - deleted) };
  } catch (e) {
    return { deleted: 0, failed: ids.length, error: getErrorMessage(e) };
  }
}

/**
 * Convenience alias for {@link getCrmChartOfAccountById} that matches the
 * naming convention used by the Rust BFF layer (`getChartOfAccountById`).
 *
 * Honours the same Rust dual-impl gate — when `USE_RUST_CRM=true`, the
 * call hits `/v1/crm/chart-of-accounts/{id}` first and only falls back to
 * the legacy Mongo aggregation pipeline on failure.
 */
export async function getChartOfAccountById(id: string): Promise<WithId<any> | null> {
    return getCrmChartOfAccountById(id);
}
