import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getRfqById } from '@/app/actions/crm-rfq.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function RfqActivityPage({ params }: PageProps) {
    const { id } = await params;
    const rfq = await getRfqById(id);
    if (!rfq) notFound();

    return (
        <EntityDetailShell
            title={(rfq as any).rfqNumber || (rfq as any).title || 'RFQ'}
            eyebrow="RFQ ACTIVITY"
            back={{
                href: `/dashboard/crm/purchases/rfqs/${id}`,
                label: 'Back to RFQ',
            }}
        >
            <EntityAuditTimeline entityKind="rfq" entityId={id} />
        </EntityDetailShell>
    );
}
