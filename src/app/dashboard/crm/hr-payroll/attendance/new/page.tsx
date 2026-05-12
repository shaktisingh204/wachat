/**
 * Create attendance — `/dashboard/crm/hr-payroll/attendance/new`.
 *
 * Server component shell. Renders the shared `<AttendanceForm>` (also
 * used by Edit). No custom-field hydration because `'attendance'` is
 * not a registered `WsCustomFieldBelongsTo`.
 */

import { CalendarCheck } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { AttendanceForm } from '../_components/attendance-form';

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
