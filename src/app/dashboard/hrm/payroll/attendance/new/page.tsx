/**
 * Create attendance — `/dashboard/hrm/payroll/attendance/new` (canonical).
 *
 * Server component shell — renders the shared `<AttendanceForm>` (also
 * used by Edit). The form posts to `saveAttendanceAction` and redirects
 * to the canonical detail page on success. No custom-fields panel —
 * `'attendance'` is not a registered `WsCustomFieldBelongsTo` target.
 *
 * Smart-default: when navigated to with `?employeeId=...`, the form
 * pre-selects that employee so the right-rail "Punch in / out" shortcut
 * on the employee profile lands in a ready-to-submit state.
 */

import { CalendarCheck } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { AttendanceForm } from '@/app/dashboard/crm/hr-payroll/attendance/_components/attendance-form';
import type { CrmAttendanceDoc } from '@/lib/rust-client/crm-attendance';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ employeeId?: string }>;
}

export default async function NewAttendancePage({ searchParams }: PageProps) {
  const { employeeId } = await searchParams;

  // The `AttendanceForm` accepts an `initial` doc and reads
  // `initial?.employeeId` to seed the `<EntityFormField>` picker. We
  // only seed the picker here — everything else stays default so the
  // user can fill the punch times manually.
  const initial = employeeId
    ? ({ employeeId } as unknown as CrmAttendanceDoc)
    : null;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New attendance record"
        subtitle="Capture a punch, leave, or correction entry."
        icon={CalendarCheck}
      />
      <AttendanceForm initial={initial} />
    </div>
  );
}
