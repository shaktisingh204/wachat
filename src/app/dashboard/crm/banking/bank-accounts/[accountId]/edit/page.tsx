import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit bank account — server wrapper that loads the account and passes
 * it to the shared <PaymentAccountFormClient> as `initial`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmPaymentAccountById } from '@/app/actions/crm-payment-accounts.actions';
import { getSession } from '@/app/actions/user.actions';

import { PaymentAccountFormClient } from '../../../all/_components/payment-account-form-client';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/bank-accounts';

export default async function EditBankAccountPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const account = await getCrmPaymentAccountById(accountId);
    if (!account) notFound();
    if (account.accountType !== 'bank') {
        redirect(`/dashboard/crm/banking/all/${accountId}/edit`);
    }

    return (
        <EntityDetailShell
            eyebrow="BANK ACCOUNT"
            title={`Edit · ${account.accountName}`}
            back={{ href: `${BASE}/${accountId}`, label: 'Back to detail' }}
        >
            <PaymentAccountFormClient initial={account} />
        </EntityDetailShell>
    );
}
