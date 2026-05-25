export const dynamic = 'force-dynamic';
/**
 * Job activity — server-rendered audit timeline.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getJobPostingById } from '@/app/actions/hr.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobActivityPage({ params }: PageProps) {
  const { id } = await params;
  const j = await getJobPostingById(id);
  if (!j) notFound();

  return (
    <EntityDetailShell
      title={(j as any).title || 'Job'}
      eyebrow="JOB ACTIVITY"
      back={{ href: `/dashboard/hrm/hr/jobs/${id}`, label: 'Back to job' }}
    >
      <EntityAuditTimeline entityKind="jobPosting" entityId={id} />
    </EntityDetailShell>
  );
}
