/**
 * Attendance activity — `/dashboard/hrm/payroll/attendance/[id]/activity`.
 *
 * Mirrors the CRM convention: a dedicated route that renders the audit
 * timeline under the shared `<EntityDetailShell>` so the breadcrumb and
 * back link stay consistent with the rest of the §1D experience.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getAttendance } from '@/app/actions/crm/attendance.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';



export default async function AttendanceActivityPage({ params }: PageProps) {
  const { id } = await params;
  const { record } = await getAttendance(id);
  if (!record) notFound();

  return (
    <EntityDetailShell
      title={fmtDate(record.date)}
      eyebrow="ATTENDANCE ACTIVITY"
      back={{
        href: `/dashboard/hrm/payroll/attendance/${id}`,
        label: 'Back to record',
      }}
    >
      <EntityAuditTimeline entityKind="attendance" entityId={id} />
    </EntityDetailShell>
  );
}
