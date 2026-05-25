import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCandidateById } from '@/app/actions/hr.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

async function CandidateActivityPageContainer({ params }: PageProps) {
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

export default function CandidateActivityPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CandidateActivityPageContainer params={params} />
    </Suspense>
  );
}
