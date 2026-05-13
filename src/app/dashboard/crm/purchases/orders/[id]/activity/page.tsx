import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPurchaseOrderById } from '@/app/actions/crm-purchase-orders.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PurchaseOrderActivityPage({ params }: PageProps) {
    const { id } = await params;
    const order = await getPurchaseOrderById(id);
    if (!order) notFound();

    return (
        <EntityDetailShell
            title={(order as any).orderNumber || (order as any).poNumber || 'Purchase Order'}
            eyebrow="PURCHASE ORDER ACTIVITY"
            back={{
                href: `/dashboard/crm/purchases/orders/${id}`,
                label: 'Back to purchase order',
            }}
        >
            <EntityAuditTimeline entityKind="purchaseOrder" entityId={id} />
        </EntityDetailShell>
    );
}
