import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit bank transaction — server page that loads the existing row and
 * the account dropdown options. Mutations flow through
 * `saveBankTransaction` (PATCH branch when a hidden `id` is present).
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

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
        <EntityDetailShell
            eyebrow="BANK TRANSACTION"
            title="Edit Bank Transaction"
            back={{ href: `${BASE}/${tx._id}`, label: 'Back to transaction' }}
        >
            <BankTransactionForm mode="edit" initial={tx} accounts={accounts} />
        </EntityDetailShell>
    );
}
