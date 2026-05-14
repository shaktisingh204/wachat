/**
 * Probation activity — server-rendered audit timeline.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getProbations } from '@/app/actions/hr.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProbationActivityPage({ params }: PageProps) {
  const { id } = await params;
  const all = (await getProbations()) as any[];
  const p = all.find((x) => String(x._id) === id);
  if (!p) notFound();

  return (
    <EntityDetailShell
      title={`Probation · ${p.employeeId ? String(p.employeeId) : ''}`}
      eyebrow="PROBATION ACTIVITY"
      back={{
        href: `/dashboard/hrm/hr/probation/${id}`,
        label: 'Back to probation',
      }}
    >
      <EntityAuditTimeline entityKind="probation" entityId={id} />
    </EntityDetailShell>
  );
}
