import { Suspense } from 'react';
import LeaveListClient from './client';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getLeaves,
  getLeaveTypes,
  getLeaveBalance,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

async function LeaveListLoader() {
  const [leaves, leaveTypes, emps, session] = await Promise.all([
    getLeaves(),
    getLeaveTypes(),
    getCrmEmployees(),
    getSession(),
  ]);

  const empList = (emps as Array<Record<string, unknown>>).map((e) => ({
    _id: String(e._id),
    firstName: e.firstName as string | undefined,
    lastName: e.lastName as string | undefined,
    email: e.email as string | undefined,
    employeeUserId: e.employeeUserId ? String(e.employeeUserId) : undefined,
    departmentId:
      (e.departmentId as string | undefined) ??
      (e.department as string | undefined) ??
      null,
  }));

  const sessionUserId = session?.user?._id ? String(session.user._id) : null;
  let availableBalance: number | null = null;

  if (sessionUserId) {
    const myEmp = empList.find((e) => String(e._id) === sessionUserId);
    if (myEmp) {
      try {
        const balanceRows = await getLeaveBalance(myEmp._id);
        availableBalance = balanceRows.reduce(
          (sum, row) => sum + row.rows.reduce((s, r) => s + (Number(r.remaining) || 0), 0),
          0,
        );
      } catch (e) {
        availableBalance = null;
      }
    }
  }

  return (
    <LeaveListClient
      initialLeaves={leaves}
      initialTypes={leaveTypes}
      initialEmployees={empList}
      sessionUserId={sessionUserId}
      initialAvailableBalance={availableBalance}
    />
  );
}

export default function LeaveListPage() {
  return (
    <Suspense
      fallback={
        <EntityListShell
          title="Leave"
          subtitle="Loading leaves..."
        >
          <div className="py-12 text-center text-[13px] text-[var(--st-text-secondary)]">Loading…</div>
        </EntityListShell>
      }
    >
      <LeaveListLoader />
    </Suspense>
  );
}
