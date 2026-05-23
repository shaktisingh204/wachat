import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmVendorById } from '@/app/actions/crm-vendors.actions';

interface PageProps {
    params: Promise<{ vendorId: string }>;
}

export default async function VendorActivityPage({ params }: PageProps) {
    const { vendorId: id } = await params;
    const vendor = await getCrmVendorById(id);
    if (!vendor) notFound();

    return (
        <EntityDetailShell
            title={(vendor as any).name || 'Vendor'}
            eyebrow="VENDOR ACTIVITY"
            back={{
                href: `/dashboard/crm/purchases/vendors/${id}`,
                label: 'Back to vendor',
            }}
        >
            <EntityAuditTimeline entityKind="vendor" entityId={id} />
        </EntityDetailShell>
    );
}
