/**
 * Edit attendance — `/dashboard/crm/hr-payroll/attendance/[id]/edit` (canonical).
 *
 * Hydrates the existing record and passes it to the shared
 * `<AttendanceForm>` (re-used from the Create flow). The form submits
 * a PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { AttendanceForm } from '@/app/dashboard/crm/hr-payroll/attendance/_components/attendance-form';
import { getAttendance } from '@/app/actions/crm/attendance.actions';

export const dynamic = 'force-dynamic';

function fmtDate(v?: string): string {
  if (!v) return 'record';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'record' : d.toLocaleDateString();
}

export default async function EditAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { record } = await getAttendance(id);

  if (!record) notFound();

  return (
    <EntityDetailShell
      title={`Edit ${fmtDate(record.date)}`}
      eyebrow="ATTENDANCE"
      back={{ href: '/dashboard/crm/hr-payroll/attendance', label: 'Attendance' }}
    >
      <AttendanceForm initial={record} />
    </EntityDetailShell>
  );
}
