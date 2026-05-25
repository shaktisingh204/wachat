export const dynamic = 'force-dynamic';
/**
 * Interview activity — server-rendered audit timeline.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getInterviewById } from '@/app/actions/hr.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewActivityPage({ params }: PageProps) {
  const { id } = await params;
  const i = await getInterviewById(id);
  if (!i) notFound();

  return (
    <EntityDetailShell
      title={`Interview · R${(i as any).roundNumber ?? '?'}`}
      eyebrow="INTERVIEW ACTIVITY"
      back={{
        href: `/dashboard/hrm/hr/interviews/${id}`,
        label: 'Back to interview',
      }}
    >
      <EntityAuditTimeline entityKind="interview" entityId={id} />
    </EntityDetailShell>
  );
}
