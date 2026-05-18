import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Landmark } from 'lucide-react';

/**
 * Edit bank account — server wrapper that loads the account and passes
 * it to the shared <PaymentAccountFormClient> as `initial`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Banking', href: '/dashboard/crm/banking' },
                    { label: 'Bank Accounts', href: BASE },
                    { label: account.accountName, href: `${BASE}/${accountId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${account.accountName}`}
                subtitle="Update bank details. Changes are revalidated immediately."
                icon={Landmark}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${accountId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to detail
                        </Link>
                    </ZoruButton>
                }
            />
            <PaymentAccountFormClient initial={account} />
        </div>
    );
}
