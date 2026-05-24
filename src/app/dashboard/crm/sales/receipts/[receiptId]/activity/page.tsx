/**
 * Payment receipt activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'paymentReceipt'`.
 */

import { notFound } from 'next/navigation';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPaymentReceiptById } from '@/app/actions/crm-payment-receipts.actions';
import { ReceiptAuditTimeline } from './_components/receipt-audit-timeline';
import { TimelineFilter } from './_components/timeline-filter';
import type { CrmPaymentReceipt } from '@/lib/definitions';

interface PageProps {
    params: Promise<{ receiptId: string }>;
    searchParams: Promise<{ type?: string }>;
}

export default async function PaymentReceiptActivityPage({ params, searchParams }: PageProps) {
    const { receiptId } = await params;
    const resolvedSearchParams = await searchParams;
    const filterType = (resolvedSearchParams.type === 'manual' || resolvedSearchParams.type === 'system') 
        ? resolvedSearchParams.type 
        : 'all';

    const receipt = await getPaymentReceiptById(receiptId);
    if (!receipt) notFound();

    // Standardize PaymentReceipt type definition handling possible DTO mismatches
    type StandardizedReceipt = CrmPaymentReceipt & { receiptNo?: string };
    const standardizedReceipt = receipt as unknown as StandardizedReceipt;
    
    const title = standardizedReceipt.receiptNumber || standardizedReceipt.receiptNo || `Receipt ${receiptId.slice(-6)}`;

    return (
        <EntityDetailShell
            title={title}
            eyebrow="PAYMENT RECEIPT ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/receipts/${receiptId}`,
                label: 'Back to receipt',
            }}
        >
            <TimelineFilter />
            <ReceiptAuditTimeline 
                entityKind="paymentReceipt" 
                entityId={receiptId} 
                filterType={filterType} 
            />
        </EntityDetailShell>
    );
}
