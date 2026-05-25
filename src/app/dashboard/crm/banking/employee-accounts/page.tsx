import * as React from 'react';
import { getCrmPaymentAccounts, getEmployeeAccountKpis } from '@/app/actions/crm-payment-accounts.actions';
import { EmployeeAccountsClient } from './client';

export const metadata = {
    title: 'Employee Accounts | SabNode CRM',
    description: 'Manage employee payout and reimbursement accounts.',
};

export default async function EmployeeAccountsPage() {
    // Fetch data concurrently on the server
    const [allAccounts, kpis] = await Promise.all([
        getCrmPaymentAccounts(),
        getEmployeeAccountKpis(),
    ]);

    // Filter to employee accounts
    const accounts = allAccounts.filter((a) => a.accountType === 'employee');

    // Ensure strict hydration stability by fully serializing the data
    const safeAccounts = JSON.parse(JSON.stringify(accounts));
    const safeKpis = JSON.parse(JSON.stringify(kpis));

    return <EmployeeAccountsClient accounts={safeAccounts} kpis={safeKpis} />;
}
