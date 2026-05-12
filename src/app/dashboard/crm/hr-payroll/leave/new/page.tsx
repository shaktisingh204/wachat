/**
 * Create leave request — `/dashboard/crm/hr-payroll/leave/new`.
 *
 * Server component: fetches the tenant's leave-type catalog once, then
 * hands off to the shared `<LeaveForm>` (also used by Edit). No
 * custom-fields panel — `'leave'` is not a registered
 * `WsCustomFieldBelongsTo` value.
 */

import { CalendarDays } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { listLeaveTypeOptions } from '@/app/actions/crm/leaves.actions';
import { LeaveForm } from '../_components/leave-form';

export const dynamic = 'force-dynamic';

export default async function NewLeavePage() {
  const { options: leaveTypes } = await listLeaveTypeOptions();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New leave request"
        subtitle="Submit a new leave application for review."
        icon={CalendarDays}
      />
      <LeaveForm leaveTypes={leaveTypes} />
    </div>
  );
}
