import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getDeliveryChallanById } from '@/app/actions/crm-delivery-challans.actions';

interface PageProps {
    params: Promise<{ challanId: string }>;
}

export default async function DeliveryChallanActivityPage({ params }: PageProps) {
    const { challanId } = await params;
    const challan = await getDeliveryChallanById(challanId);
    if (!challan) notFound();
    const title = String((challan as any).challanNumber ?? 'Delivery Challan');

    return (
        <EntityDetailShell
            title={title}
            eyebrow="DELIVERY ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/delivery/${challanId}`,
                label: 'Back to delivery challan',
            }}
        >
            <EntityAuditTimeline entityKind="deliveryChallan" entityId={challanId} />
        </EntityDetailShell>
    );
}
