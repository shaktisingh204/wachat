import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPaymentReceipt } from '@/app/actions/crm/payment-receipts.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PaymentActivityPage({ params }: PageProps) {
    const { id } = await params;
    const res = await getPaymentReceipt(id);
    if (!res?.receipt) notFound();
    const receipt = res.receipt;
    const title = String((receipt as any).receiptNo ?? id);

    return (
        <EntityDetailShell
            title={title}
            eyebrow="PAYMENT ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/payments/${id}`,
                label: 'Back to payment',
            }}
        >
            <EntityAuditTimeline entityKind="paymentReceipt" entityId={id} />
        </EntityDetailShell>
    );
}
