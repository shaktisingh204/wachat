import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/sabcrm/20ui';
import { getSession } from '@/app/actions/user.actions';
import { getCrmBankTransactionById } from '@/app/actions/crm-bank-transactions.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import { BankTransactionForm } from '../../_components/bank-transaction-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/bank-transactions';

async function EditBankTransactionDataLoader({ id }: { id: string }) {
    const [tx, accountsRaw] = await Promise.all([
        getCrmBankTransactionById(id),
        getCrmPaymentAccounts(),
    ]);
    
    if (!tx) notFound();
    
    const accounts = accountsRaw.map((a) => ({
        _id: a._id.toString(),
        accountName: a.accountName,
    }));

    return (
        <BankTransactionForm 
            mode="edit" 
            initial={tx} 
            accounts={accounts} 
            defaultDate={new Date().toISOString().slice(0, 10)}
        />
    );
}

export default async function EditBankTransactionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="BANK TRANSACTION"
            title="Edit Bank Transaction"
            back={{ href: `${BASE}/${id}`, label: 'Back to transaction' }}
        >
            <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-xl" />}>
                <EditBankTransactionDataLoader id={id} />
            </Suspense>
        </EntityDetailShell>
    );
}
