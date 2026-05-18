import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PaymentAccountFormClient } from '../_components/payment-account-form-client';

export default function NewPaymentAccountPage() {
    return (
        <EntityDetailShell
            eyebrow="PAYMENT ACCOUNT"
            title="New Payment Account"
            back={{ href: '/dashboard/crm/banking/all', label: 'Payment Accounts' }}
        >
            <PaymentAccountFormClient />
        </EntityDetailShell>
    );
}
