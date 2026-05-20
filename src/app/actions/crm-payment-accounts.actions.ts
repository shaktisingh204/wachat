'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmPaymentAccount, CrmVoucherEntry, BankAccountDetails } from '@/lib/definitions';
import { coerceFiniteMoney } from '@/lib/crm/number-safety';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmPaymentAccountsApi } from '@/lib/rust-client/crm-payment-accounts';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getCrmPaymentAccountById(accountId: string): Promise<WithId<CrmPaymentAccount> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(accountId)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmPaymentAccountsApi.getById(accountId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getCrmPaymentAccountById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'payment_account',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const account = await db.collection<CrmPaymentAccount>('crm_payment_accounts').findOne({
            _id: new ObjectId(accountId),
            userId,
        });
        if (!account) return null;

        // Inline current balance same way getCrmPaymentAccounts does for the list.
        const voucherEntries = await db.collection<CrmVoucherEntry>('crm_voucher_entries').find({
            userId,
            $or: [
                { 'debitEntries.accountId': account._id },
                { 'creditEntries.accountId': account._id },
            ],
        }).toArray();

        let balance = account.openingBalance || 0;
        for (const entry of voucherEntries) {
            for (const d of entry.debitEntries || []) {
                if (d.accountId?.equals(account._id)) balance += d.amount || 0;
            }
            for (const c of entry.creditEntries || []) {
                if (c.accountId?.equals(account._id)) balance -= c.amount || 0;
            }
        }
        (account as any).currentBalance = balance;
        return JSON.parse(JSON.stringify(account));
    } catch (e) {
        console.error('Failed to fetch payment account by ID:', e);
        return null;
    }
}

export async function getCrmPaymentAccounts(): Promise<WithId<CrmPaymentAccount>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const accounts = await db.collection<CrmPaymentAccount>('crm_payment_accounts')
            .find({ userId })
            .sort({ accountName: 1 })
            .toArray();

        // Calculate current balance for each account
        for (const account of accounts) {
            const voucherEntries = await db.collection<CrmVoucherEntry>('crm_voucher_entries').find({
                userId,
                $or: [
                    { 'debitEntries.accountId': account._id },
                    { 'creditEntries.accountId': account._id }
                ]
            }).toArray();

            let balance = account.openingBalance;
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
            (account as any).currentBalance = balance;
        }

        return JSON.parse(JSON.stringify(accounts));
    } catch (e: any) {
        console.error("Failed to fetch CRM Payment Accounts:", e);
        return [];
    }
}

export async function saveCrmPaymentAccount(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_payment_account', 'create');
    if (!guard.ok) return { error: guard.error };

    const accountId = formData.get('accountId') as string | null;
    const isEditing = !!accountId;
    const accountType = formData.get('accountType') as CrmPaymentAccount['accountType'];

    try {
        const openingBalanceStr = formData.get('openingBalance') as string;
        const openingBalance = coerceFiniteMoney(openingBalanceStr);

        const openingBalanceDateStr = formData.get('openingBalanceDate') as string;
        const openingBalanceDate = openingBalanceDateStr ? new Date(openingBalanceDateStr) : new Date();

        const bankDetailsString = formData.get('bankAccountDetails') as string | null;
        let bankDetails: Partial<BankAccountDetails> | undefined;
        if (bankDetailsString) {
            try {
                bankDetails = JSON.parse(bankDetailsString);
            } catch (e) {
                console.warn("Could not parse bank account details.");
            }
        }

        const accountData: Partial<Omit<CrmPaymentAccount, '_id'>> = {
            userId: new ObjectId(session.user._id),
            accountName: formData.get('accountName') as string,
            accountType,
            status: formData.get('status') === 'on' ? 'active' : 'inactive',
            openingBalance,
            openingBalanceDate: openingBalanceDate,
            currency: formData.get('currency') as string,
            isDefault: formData.get('isDefault') === 'on',
        };

        if (accountType === 'bank' && bankDetails) {
            accountData.bankDetails = bankDetails;
        }

        if (!accountData.accountName || !accountData.accountType) {
            return { error: 'Account Name and Type are required.' };
        }

        const { db } = await connectToDatabase();

        if (accountData.isDefault) {
            await db.collection('crm_payment_accounts').updateMany({ userId: accountData.userId }, { $set: { isDefault: false } });
        }

        let savedId: string;
        if (isEditing && ObjectId.isValid(accountId)) {
            await db.collection('crm_payment_accounts').updateOne(
                { _id: new ObjectId(accountId), userId: new ObjectId(session.user._id) },
                { $set: { ...accountData, updatedAt: new Date() } }
            );
            savedId = accountId;
        } else {
            const result = await db.collection('crm_payment_accounts').insertOne({
                ...accountData,
                createdAt: new Date(),
                updatedAt: new Date()
            } as CrmPaymentAccount);
            savedId = result.insertedId.toString();
        }

        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: isEditing ? 'update' : 'create',
            entityKind: 'payment_account',
            entityId: savedId,
            reason: accountData.accountName,
        });

        revalidatePath('/dashboard/crm/banking/all');
        revalidatePath('/dashboard/crm/banking/bank-accounts');
        revalidatePath('/dashboard/crm/banking/employee-accounts');
        revalidatePath(`/dashboard/crm/banking/all/${savedId}`);
        return { message: `Account "${accountData.accountName}" saved successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmPaymentAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    const guard = await requirePermission('crm_payment_account', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!accountId || !ObjectId.isValid(accountId)) {
        return { success: false, error: 'Invalid Account ID' };
    }

    try {
        const { db } = await connectToDatabase();

        // You might want to add a check here to prevent deletion if there are transactions associated with this account.

        await db.collection('crm_payment_accounts').deleteOne({
            _id: new ObjectId(accountId),
            userId: new ObjectId(session.user._id)
        });
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'delete',
            entityKind: 'payment_account',
            entityId: accountId,
        });
        revalidatePath('/dashboard/crm/banking/all');
        revalidatePath('/dashboard/crm/banking/bank-accounts');
        revalidatePath('/dashboard/crm/banking/employee-accounts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * KPI aggregate for the Bank Accounts list page.
 *
 * - totalAccounts: number of bank-type payment accounts
 * - totalBalance: sum of currentBalance across bank accounts (in their
 *   recorded currency — listing pages typically use INR; we surface the
 *   numeric sum and let the UI format with `en-IN` INR)
 * - banksCount: distinct bank names
 * - lastUpdatedAt: most recent `updatedAt` across bank accounts (proxy
 *   for "last reconciled" until a dedicated reconciliation field lands)
 */
export interface BankAccountKpis {
    totalAccounts: number;
    totalBalance: number;
    banksCount: number;
    lastUpdatedAt: string | null;
}

export async function getBankAccountKpis(): Promise<BankAccountKpis> {
    const session = await getSession();
    if (!session?.user) return { totalAccounts: 0, totalBalance: 0, banksCount: 0, lastUpdatedAt: null };

    try {
        const accounts = await getCrmPaymentAccounts();
        const bankAccounts = accounts.filter((a) => a.accountType === 'bank');
        const totalBalance = bankAccounts.reduce(
            (sum, a) => sum + (typeof a.currentBalance === 'number' ? a.currentBalance : 0),
            0,
        );
        const distinctBanks = new Set(
            bankAccounts
                .map((a) => a.bankDetails?.bankName?.trim().toLowerCase())
                .filter((n): n is string => !!n),
        );
        const lastUpdatedAt = bankAccounts.reduce<Date | null>((latest, a) => {
            const u = a.updatedAt ? new Date(a.updatedAt) : null;
            if (!u) return latest;
            return !latest || u.getTime() > latest.getTime() ? u : latest;
        }, null);
        return {
            totalAccounts: bankAccounts.length,
            totalBalance,
            banksCount: distinctBanks.size,
            lastUpdatedAt: lastUpdatedAt ? lastUpdatedAt.toISOString() : null,
        };
    } catch (e) {
        console.error('[getBankAccountKpis] failed:', e);
        return { totalAccounts: 0, totalBalance: 0, banksCount: 0, lastUpdatedAt: null };
    }
}

/**
 * KPI aggregate for the Employee Accounts list page.
 *
 * - totalEmployees: number of employee-type payment accounts
 * - totalBalance: sum of currentBalance across employee accounts
 * - activeAccounts: status === 'active'
 * - unverifiedCount: accounts missing bank IFSC + accountNumber (proxy
 *   for "unverified payout details" until a dedicated verified flag
 *   lands)
 */
export interface EmployeeAccountKpis {
    totalEmployees: number;
    totalBalance: number;
    activeAccounts: number;
    unverifiedCount: number;
}

export async function getEmployeeAccountKpis(): Promise<EmployeeAccountKpis> {
    const session = await getSession();
    if (!session?.user) return { totalEmployees: 0, totalBalance: 0, activeAccounts: 0, unverifiedCount: 0 };

    try {
        const accounts = await getCrmPaymentAccounts();
        const employeeAccounts = accounts.filter((a) => a.accountType === 'employee');
        const totalBalance = employeeAccounts.reduce(
            (sum, a) => sum + (typeof a.currentBalance === 'number' ? a.currentBalance : 0),
            0,
        );
        const activeAccounts = employeeAccounts.filter((a) => a.status === 'active').length;
        const unverifiedCount = employeeAccounts.filter((a) => {
            const ifsc = a.bankDetails?.ifsc?.trim();
            const num = a.bankDetails?.accountNumber?.trim();
            return !ifsc || !num;
        }).length;
        return {
            totalEmployees: employeeAccounts.length,
            totalBalance,
            activeAccounts,
            unverifiedCount,
        };
    } catch (e) {
        console.error('[getEmployeeAccountKpis] failed:', e);
        return { totalEmployees: 0, totalBalance: 0, activeAccounts: 0, unverifiedCount: 0 };
    }
}

export async function bulkUpdateCrmPaymentAccounts(
    ids: string[],
    op: 'archive' | 'activate' | 'delete'
): Promise<{ success: boolean; updated?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission(
        'crm_payment_account',
        op === 'delete' ? 'delete' : 'edit',
    );
    if (!guard.ok) return { success: false, error: guard.error };
    const oids = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (oids.length === 0) return { success: false, error: 'No valid IDs supplied' };
    try {
        const { db } = await connectToDatabase();
        const filter = { _id: { $in: oids }, userId: new ObjectId(session.user._id) };
        let updated = 0;
        if (op === 'delete') {
            const r = await db.collection('crm_payment_accounts').deleteMany(filter);
            updated = r.deletedCount ?? 0;
        } else {
            const r = await db
                .collection('crm_payment_accounts')
                .updateMany(filter, { $set: { status: op === 'activate' ? 'active' : 'inactive', updatedAt: new Date() } });
            updated = r.modifiedCount ?? 0;
        }
        for (const id of ids) {
            await writeAuditEntry({
                tenantUserId: session.user._id,
                action: op === 'delete' ? 'delete' : op === 'archive' ? 'archive' : 'restore',
                entityKind: 'payment_account',
                entityId: id,
                reason: 'bulk',
            });
        }
        revalidatePath('/dashboard/crm/banking/all');
        revalidatePath('/dashboard/crm/banking/bank-accounts');
        revalidatePath('/dashboard/crm/banking/employee-accounts');
        return { success: true, updated };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
