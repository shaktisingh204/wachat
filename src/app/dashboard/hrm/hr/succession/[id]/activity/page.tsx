import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmSuccessionPlanById } from '@/app/actions/crm-succession.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function SuccessionActivityPage({ params }: PageProps) {
    const { id } = await params;
    const plan = await getCrmSuccessionPlanById(id);
    if (!plan) notFound();

    return (
        <EntityDetailShell
            title={(plan as any).role || 'Succession plan'}
            eyebrow="SUCCESSION ACTIVITY"
            back={{ href: `/dashboard/hrm/hr/succession/${id}`, label: 'Back to plan' }}
        >
            <EntityAuditTimeline entityKind="succession" entityId={id} />
        </EntityDetailShell>
    );
}
