import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  ArrowLeftRight } from 'lucide-react';

/**
 * Edit bank transaction — server page that loads the existing row and
 * the account dropdown options. Mutations flow through
 * `saveBankTransaction` (PATCH branch when a hidden `id` is present).
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

import { getSession } from '@/app/actions/user.actions';
import {
    getCrmBankTransactionById,
} from '@/app/actions/crm-bank-transactions.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import { BankTransactionForm } from '../../_components/bank-transaction-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/bank-transactions';

export default async function EditBankTransactionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Banking', href: '/dashboard/crm/banking' },
                    { label: 'Bank Transactions', href: BASE },
                    {
                        label: tx.referenceNumber || tx._id.slice(0, 8),
                        href: `${BASE}/${tx._id}`,
                    },
                    { label: 'Edit' },
                ]}
                title="Edit Bank Transaction"
                subtitle="Update the description, category, amount, status, or attached statement."
                icon={ArrowLeftRight}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${tx._id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Link>
                    </ZoruButton>
                }
            />
            <BankTransactionForm mode="edit" initial={tx} accounts={accounts} />
        </div>
    );
}
