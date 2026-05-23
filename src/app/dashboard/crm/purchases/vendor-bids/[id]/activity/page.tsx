import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getVendorBid } from '@/app/actions/crm/vendor-bids.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function VendorBidActivityPage({ params }: PageProps) {
    const { id } = await params;
    const { bid } = await getVendorBid(id);
    if (!bid) notFound();

    return (
        <EntityDetailShell
            title={bid.vendorName || `VB-${String(bid._id).slice(-6).toUpperCase()}`}
            eyebrow="VENDOR BID ACTIVITY"
            back={{
                href: `/dashboard/crm/purchases/vendor-bids/${id}`,
                label: 'Back to vendor bid',
            }}
        >
            <EntityAuditTimeline entityKind="vendorBid" entityId={id} />
        </EntityDetailShell>
    );
}
