import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getGrnById } from '@/app/actions/crm-grn.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function GrnActivityPage({ params }: PageProps) {
    const { id } = await params;
    const grn = await getGrnById(id);
    if (!grn) notFound();

    return (
        <EntityDetailShell
            title={(grn as any).grnNumber || (grn as any).grnNo || 'GRN'}
            eyebrow="GRN ACTIVITY"
            back={{
                href: `/dashboard/crm/inventory/grn/${id}`,
                label: 'Back to GRN',
            }}
        >
            <EntityAuditTimeline entityKind="grn" entityId={id} />
        </EntityDetailShell>
    );
}
