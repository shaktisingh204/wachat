import { ZoruButton } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { ArrowLeft,
  ArrowLeftRight } from 'lucide-react';

/**
 * New bank transaction — server page that pre-loads the list of payment
 * accounts so the form can render a real dropdown (the action validates
 * the chosen id is an ObjectId belonging to this user).
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Banking', href: '/dashboard/crm/banking' },
                    { label: 'Bank Transactions', href: BASE },
                    { label: 'New' },
                ]}
                title="New Bank Transaction"
                subtitle="Manually record a single statement-level transaction."
                icon={ArrowLeftRight}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <BankTransactionForm mode="new" accounts={accounts} />
        </div>
    );
}
