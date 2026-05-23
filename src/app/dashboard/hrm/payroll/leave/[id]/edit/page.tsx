/**
 * Edit leave request — `/dashboard/hrm/payroll/leave/[id]/edit` (canonical).
 *
 * Hydrates the existing application + the leave-type catalog, then
 * passes both to the shared `<LeaveForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a
 * hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { LeaveForm } from '@/app/dashboard/hrm/payroll/leave/_components/leave-form';
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
    <EntityListShell
      title={`Edit ${ltLabel}`}
      subtitle="Update leave request details."
    >
      <LeaveForm initial={leave} leaveTypes={leaveTypes} />
    </EntityListShell>
  );
}
