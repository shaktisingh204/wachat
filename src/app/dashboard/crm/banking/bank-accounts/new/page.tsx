import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PaymentAccountFormClient } from '../../all/_components/payment-account-form-client';

/**
 * New bank account — pre-filled with `accountType=bank` via the form's
 * default. Reuses the shared <PaymentAccountFormClient> from
 * /banking/all/_components so behaviour stays consistent with the
 * canonical payment-accounts surface.
 */

const BASE = '/dashboard/crm/banking/bank-accounts';

export default function NewBankAccountPage() {
    return (
        <EntityDetailShell
            eyebrow="BANK ACCOUNT"
            title="New Bank Account"
            back={{ href: BASE, label: 'Bank Accounts' }}
        >
            <PaymentAccountFormClient />
        </EntityDetailShell>
    );
}
