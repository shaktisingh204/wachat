/**
 * Onboarding activity — server-rendered audit timeline.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getOnboardingTemplates } from '@/app/actions/hr.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OnboardingActivityPage({ params }: PageProps) {
  const { id } = await params;
  const all = (await getOnboardingTemplates()) as any[];
  const o = all.find((x) => String(x._id) === id);
  if (!o) notFound();

  return (
    <EntityDetailShell
      title={(o as any).task_name || (o as any).name || 'Onboarding'}
      eyebrow="ONBOARDING ACTIVITY"
      back={{
        href: `/dashboard/hrm/hr/onboarding/${id}`,
        label: 'Back to onboarding',
      }}
    >
      <EntityAuditTimeline entityKind="onboarding" entityId={id} />
    </EntityDetailShell>
  );
}
