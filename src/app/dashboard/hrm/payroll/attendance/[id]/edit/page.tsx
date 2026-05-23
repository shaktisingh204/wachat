/**
 * Edit attendance — `/dashboard/hrm/payroll/attendance/[id]/edit` (canonical).
 *
 * Hydrates the existing record and passes it to the shared
 * `<AttendanceForm>` (re-used from the Create flow). The form submits
 * a PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { AttendanceForm } from '@/app/dashboard/hrm/payroll/attendance/_components/attendance-form';
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
    <EntityListShell
      title={`Edit ${fmtDate(record.date)}`}
      subtitle="Update attendance details."
    >
      <AttendanceForm initial={record} />
    </EntityListShell>
  );
}
