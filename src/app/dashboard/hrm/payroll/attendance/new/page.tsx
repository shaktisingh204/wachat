/**
 * Create attendance — `/dashboard/hrm/payroll/attendance/new` (canonical).
 *
 * Server component shell — renders the shared `<AttendanceForm>` (also
 * used by Edit). The form posts to `saveAttendanceAction` and redirects
 * to the canonical detail page on success. No custom-fields panel —
 * `'attendance'` is not a registered `WsCustomFieldBelongsTo` target.
 */

import { CalendarCheck } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { AttendanceForm } from '@/app/dashboard/crm/hr-payroll/attendance/_components/attendance-form';

export const dynamic = 'force-dynamic';

export default function NewAttendancePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New attendance record"
        subtitle="Capture a punch, leave, or correction entry."
        icon={CalendarCheck}
      />
      <AttendanceForm />
    </div>
  );
}
