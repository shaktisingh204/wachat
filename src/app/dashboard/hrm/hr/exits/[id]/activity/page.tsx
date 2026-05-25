export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getExitById } from '@/app/actions/crm-exits.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ExitActivityPage({ params }: PageProps) {
    const { id } = await params;
    const exit = await getExitById(id);
    if (!exit) notFound();

    return (
        <EntityDetailShell
            title={(exit as any).employeeName || 'Exit'}
            eyebrow="EXIT ACTIVITY"
            back={{ href: `/dashboard/hrm/hr/exits/${id}`, label: 'Back to exit' }}
        >
            <EntityAuditTimeline entityKind="exit" entityId={id} />
        </EntityDetailShell>
    );
}
