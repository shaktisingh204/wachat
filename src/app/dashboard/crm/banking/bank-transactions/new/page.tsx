import {
  redirect } from 'next/navigation';

/**
 * New bank transaction — server page that pre-loads the list of payment
 * accounts so the form can render a real dropdown (the action validates
 * the chosen id is an ObjectId belonging to this user).
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import { getSession } from '@/app/actions/user.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import { BankTransactionForm } from '../_components/bank-transaction-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/bank-transactions';

export default async function NewBankTransactionPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const accountsRaw = await getCrmPaymentAccounts();
    const accounts = accountsRaw.map((a) => ({
        _id: a._id.toString(),
        accountName: a.accountName,
    }));

    return (
        <EntityDetailShell
            eyebrow="BANK TRANSACTION"
            title="New Bank Transaction"
            back={{ href: BASE, label: 'Bank Transactions' }}
        >
            <BankTransactionForm mode="new" accounts={accounts} />
        </EntityDetailShell>
    );
}
