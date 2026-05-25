import { redirect } from 'next/navigation';
import { Suspense } from 'react';

/**
 * New bank transaction — server page that pre-loads the list of payment
 * accounts so the form can render a real dropdown (the action validates
 * the chosen id is an ObjectId belonging to this user).
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import { getSession } from '@/app/actions/user.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import { BankTransactionForm } from '../_components/bank-transaction-form';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/bank-transactions';

async function BankTransactionFormWrapper() {
    const accountsRaw = await getCrmPaymentAccounts();
    const accounts = accountsRaw.map((a) => ({
        _id: a._id.toString(),
        accountName: a.accountName,
    }));

    const serverDefaultDate = new Date().toISOString().slice(0, 10);

    return <BankTransactionForm mode="new" accounts={accounts} defaultDate={serverDefaultDate} />;
}

function FormSkeleton() {
    return (
        <div className="space-y-6 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-6 shadow-sm">
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>

                <div className="space-y-2 mt-6">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-zoru-line mt-6">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-32" />
            </div>
        </div>
    );
}

export default async function NewBankTransactionPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="BANK TRANSACTION"
            title="New Bank Transaction"
            back={{ href: BASE, label: 'Bank Transactions' }}
        >
            <Suspense fallback={<FormSkeleton />}>
                <BankTransactionFormWrapper />
            </Suspense>
        </EntityDetailShell>
    );
}
