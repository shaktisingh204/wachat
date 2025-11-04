
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmPaymentAccount, CrmVoucherEntry, BankAccountDetails } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

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

    const accountId = formData.get('accountId') as string | null;
    const isEditing = !!accountId;
    const accountType = formData.get('accountType') as CrmPaymentAccount['accountType'];

    try {
        const openingBalanceStr = formData.get('openingBalance') as string;
        const openingBalance = openingBalanceStr ? Number(openingBalanceStr) : 0;
        
        const openingBalanceDateStr = formData.get('openingBalanceDate') as string;
        const openingBalanceDate = openingBalanceDateStr ? new Date(openingBalanceDateStr) : new Date();

        const bankDetailsString = formData.get('bankAccountDetails') as string | null;
        let bankDetails: Partial<BankAccountDetails> | undefined;
        if(bankDetailsString) {
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
            openingBalance: isNaN(openingBalance) ? 0 : openingBalance,
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

        if (isEditing && ObjectId.isValid(accountId)) {
            await db.collection('crm_payment_accounts').updateOne(
                { _id: new ObjectId(accountId), userId: new ObjectId(session.user._id) },
                { $set: accountData }
            );
        } else {
            await db.collection('crm_payment_accounts').insertOne({
                ...accountData,
                createdAt: new Date(),
                updatedAt: new Date()
            } as CrmPaymentAccount);
        }
        
        revalidatePath('/dashboard/crm/banking/all');
        return { message: `Account "${accountData.accountName}" saved successfully.` };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmPaymentAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

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
        revalidatePath('/dashboard/crm/banking/all');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
