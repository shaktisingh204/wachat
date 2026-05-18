/**
 * Edit attendance — `/dashboard/crm/hr-payroll/attendance/[id]/edit` (canonical).
 *
 * Hydrates the existing record and passes it to the shared
 * `<AttendanceForm>` (re-used from the Create flow). The form submits
 * a PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';
import { CalendarCheck } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${fmtDate(record.date)}`}
        subtitle="Update attendance details."
        icon={CalendarCheck}
      />
      <AttendanceForm initial={record} />
    </div>
  );
}
