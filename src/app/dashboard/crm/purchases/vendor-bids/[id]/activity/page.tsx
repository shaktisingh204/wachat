import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getVendorBidById } from '@/app/actions/crm-vendor-bids.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function VendorBidActivityPage({ params }: PageProps) {
    const { id } = await params;
    const bid = await getVendorBidById(id);
    if (!bid) notFound();

    return (
        <EntityDetailShell
            title={(bid as any).bidNumber || (bid as any).title || 'Vendor Bid'}
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
