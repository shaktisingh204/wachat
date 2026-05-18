/**
 * Payment receipt activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'paymentReceipt'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPaymentReceiptById } from '@/app/actions/crm-payment-receipts.actions';

interface PageProps {
    params: Promise<{ receiptId: string }>;
}

export default async function PaymentReceiptActivityPage({ params }: PageProps) {
    const { receiptId } = await params;
    const receipt = await getPaymentReceiptById(receiptId);
    if (!receipt) notFound();

    const title = (receipt as any).receiptNumber || (receipt as any).receiptNo || `Receipt ${receiptId.slice(-6)}`;

    return (
        <EntityDetailShell
            title={title}
            eyebrow="PAYMENT RECEIPT ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/receipts/${receiptId}`,
                label: 'Back to receipt',
            }}
        >
            <EntityAuditTimeline entityKind="paymentReceipt" entityId={receiptId} />
        </EntityDetailShell>
    );
}
