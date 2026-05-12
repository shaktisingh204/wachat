/**
 * Edit leave request — `/dashboard/crm/hr-payroll/leave/[id]/edit`.
 *
 * Hydrates the existing application + the leave-type catalog, then
 * passes both to the shared `<LeaveForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a
 * hidden input.
 */

import { notFound } from 'next/navigation';
import { CalendarDays } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { LeaveForm } from '../../_components/leave-form';
import {
  getLeave,
  listLeaveTypeOptions,
} from '@/app/actions/crm/leaves.actions';

export const dynamic = 'force-dynamic';

export default async function EditLeavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ leave }, { options: leaveTypes }] = await Promise.all([
    getLeave(id),
    listLeaveTypeOptions(),
  ]);

  if (!leave) notFound();

  const leaveType = leaveTypes.find((lt) => lt._id === leave.leaveTypeId);
  const ltLabel = leaveType
    ? `${leaveType.code} · ${leaveType.name}`
    : 'Leave request';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${ltLabel}`}
        subtitle="Update leave request details."
        icon={CalendarDays}
      />
      <LeaveForm initial={leave} leaveTypes={leaveTypes} />
    </div>
  );
}
