import { notFound } from 'next/navigation';
import { Landmark } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getCrmPaymentAccountById } from '@/app/actions/crm-payment-accounts.actions';

import { PaymentAccountFormClient } from '../../_components/payment-account-form-client';

export default async function EditPaymentAccountPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const account = await getCrmPaymentAccountById(accountId);
    if (!account) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Banking', href: '/dashboard/crm/banking' },
                    { label: 'Payment Accounts', href: '/dashboard/crm/banking/all' },
                    {
                        label: account.accountName,
                        href: `/dashboard/crm/banking/all/${accountId}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit ${account.accountName}`}
                subtitle="Update payment account details."
                icon={Landmark}
            />
            <PaymentAccountFormClient initial={account} />
        </div>
    );
}
