import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCandidateById } from '@/app/actions/hr.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function CandidateActivityPage({ params }: PageProps) {
    const { id } = await params;
    const c = await getCandidateById(id);
    if (!c) notFound();

    return (
        <EntityDetailShell
            title={(c as any).name || 'Candidate'}
            eyebrow="CANDIDATE ACTIVITY"
            back={{ href: `/dashboard/hrm/hr/candidates/${id}`, label: 'Back to candidate' }}
        >
            <EntityAuditTimeline entityKind="candidate" entityId={id} />
        </EntityDetailShell>
    );
}
