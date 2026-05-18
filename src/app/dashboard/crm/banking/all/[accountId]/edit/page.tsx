import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmPaymentAccountById } from '@/app/actions/crm-payment-accounts.actions';

import { PaymentAccountFormClient } from '../../_components/payment-account-form-client';

export default async function EditPaymentAccountPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const account = await getCrmPaymentAccountById(accountId);
    if (!account) notFound();

    return (
        <EntityDetailShell
            eyebrow="PAYMENT ACCOUNT"
            title={`Edit ${account.accountName}`}
            back={{ href: `/dashboard/crm/banking/all/${accountId}`, label: 'Back to account' }}
        >
            <PaymentAccountFormClient initial={account} />
        </EntityDetailShell>
    );
}
