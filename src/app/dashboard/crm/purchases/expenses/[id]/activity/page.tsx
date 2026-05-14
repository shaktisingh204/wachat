/**
 * Bill activity log — `/dashboard/crm/purchases/expenses/[id]/activity`.
 *
 * Sources the audit trail via `<EntityAuditTimeline entityKind="bill">`.
 * Uses `getBill` (Rust BFF) for the page title.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getBill } from '@/app/actions/crm/bills.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function BillActivityPage({ params }: PageProps) {
    const { id } = await params;
    const { bill } = await getBill(id);
    if (!bill) notFound();

    const title = bill.billNo || bill.vendorInvoiceNo || 'Bill';

    return (
        <EntityDetailShell
            title={title}
            eyebrow="BILL ACTIVITY"
            back={{
                href: `/dashboard/crm/purchases/expenses/${id}`,
                label: 'Back to bill',
            }}
        >
            <EntityAuditTimeline entityKind="bill" entityId={id} />
        </EntityDetailShell>
    );
}
