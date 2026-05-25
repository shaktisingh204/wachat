import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmPaymentAccountById } from '@/app/actions/crm-payment-accounts.actions';

import { PaymentAccountFormClient } from '../../_components/payment-account-form-client';

interface EditPaymentAccountPageProps {
    params: Promise<{ accountId: string }>;
}

export async function generateMetadata(props: EditPaymentAccountPageProps): Promise<Metadata> {
    const { accountId } = await props.params;
    const account = await getCrmPaymentAccountById(accountId);

    if (!account) {
        return {
            title: 'Account Not Found',
        };
    }

    return {
        title: `Edit ${account.accountName} | SabNode CRM`,
        description: `Edit payment account details for ${account.accountName}.`,
    };
}

export default async function EditPaymentAccountPage(props: EditPaymentAccountPageProps) {
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
