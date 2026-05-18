import { ZoruButton } from '@/components/zoruui';
import { ArrowLeft, Landmark } from 'lucide-react';

/**
 * New bank account — pre-filled with `accountType=bank` via the form's
 * default. Reuses the shared <PaymentAccountFormClient> from
 * /banking/all/_components so behaviour stays consistent with the
 * canonical payment-accounts surface.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { PaymentAccountFormClient } from '../../all/_components/payment-account-form-client';

const BASE = '/dashboard/crm/banking/bank-accounts';

export default function NewBankAccountPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Banking', href: '/dashboard/crm/banking' },
                    { label: 'Bank Accounts', href: BASE },
                    { label: 'New' },
                ]}
                title="New Bank Account"
                subtitle="Add bank details so this account can post into the ledger."
                icon={Landmark}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <PaymentAccountFormClient />
        </div>
    );
}
