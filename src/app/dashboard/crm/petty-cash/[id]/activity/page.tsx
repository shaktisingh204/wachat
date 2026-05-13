import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPettyCashFloatById } from '@/app/actions/crm-petty-cash.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PettyCashActivityPage({ params }: PageProps) {
    const { id } = await params;
    const float = await getPettyCashFloatById(id);
    if (!float) notFound();

    return (
        <EntityDetailShell
            title={float.name || 'Petty Cash Float'}
            eyebrow="PETTY CASH ACTIVITY"
            back={{ href: `/dashboard/crm/petty-cash/${id}`, label: 'Back to float' }}
        >
            <EntityAuditTimeline entityKind="petty_cash" entityId={id} />
        </EntityDetailShell>
    );
}
