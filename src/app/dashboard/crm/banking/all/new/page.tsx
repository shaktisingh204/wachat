import { Landmark } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { PaymentAccountFormClient } from '../_components/payment-account-form-client';

export default function NewPaymentAccountPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Banking', href: '/dashboard/crm/banking' },
                    { label: 'Payment Accounts', href: '/dashboard/crm/banking/all' },
                    { label: 'New' },
                ]}
                title="New Payment Account"
                subtitle="Add a bank, cash, employee, wallet or other account."
                icon={Landmark}
            />
            <PaymentAccountFormClient />
        </div>
    );
}
