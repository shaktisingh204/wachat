import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getCrmPaymentAccountById } from '@/app/actions/crm-payment-accounts.actions';

export default async function PaymentAccountActivityPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const account = await getCrmPaymentAccountById(accountId);
    if (!account) notFound();

    return (
        <EntityDetailShell
            eyebrow="PAYMENT ACCOUNT"
            title={account.accountName}
            back={{ href: `/dashboard/crm/banking/all/${accountId}`, label: 'Back to account' }}
        >
            <EntityAuditTimeline entityKind="payment_account" entityId={accountId} />
        </EntityDetailShell>
    );
}
