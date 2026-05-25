import * as React from 'react';
import { getCrmPaymentAccounts, getBankAccountKpis } from '@/app/actions/crm-payment-accounts.actions';
import BankAccountsClient from './client';

export const metadata = {
    title: 'Bank Accounts - CRM Banking | SabWa',
    description: 'Connected business bank accounts, balances, and reconciliation.',
};

export default async function BankAccountsPage() {
    // Parallel data fetching on the server
    const [allAccounts, kpis] = await Promise.all([
        getCrmPaymentAccounts(),
        getBankAccountKpis(),
    ]);

    // Filter only bank accounts on the server
    const accounts = allAccounts.filter((a) => a.accountType === 'bank');

    return (
        <BankAccountsClient 
            initialAccounts={accounts} 
            initialKpis={kpis ?? {
                totalAccounts: 0,
                totalBalance: 0,
                banksCount: 0,
                lastUpdatedAt: null,
            }} 
        />
    );
}
