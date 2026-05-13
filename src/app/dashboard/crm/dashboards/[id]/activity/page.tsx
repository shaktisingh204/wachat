import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getDashboardById } from '@/app/actions/crm-dashboards.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function DashboardActivityPage({ params }: PageProps) {
    const { id } = await params;
    const d = await getDashboardById(id);
    if (!d) notFound();

    return (
        <EntityDetailShell
            title={d.name || 'Dashboard'}
            eyebrow="DASHBOARD ACTIVITY"
            back={{ href: `/dashboard/crm/dashboards/${id}`, label: 'Back to dashboard' }}
        >
            <EntityAuditTimeline entityKind="dashboard" entityId={id} />
        </EntityDetailShell>
    );
}
