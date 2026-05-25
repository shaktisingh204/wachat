import { Suspense } from 'react';
import ApplyLeaveClient from './client';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/zoruui';
import {
  getLeaveTypes,
  getLeaveBalance,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

export const dynamic = 'force-dynamic';

async function ApplyLeaveLoader() {
  const [ts, es, bs] = await Promise.all([
    getLeaveTypes(),
    getCrmEmployees(),
    getLeaveBalance(),
  ]);

  const employees = (es as any[]).map((e) => ({
    _id: String(e._id),
    firstName: e.firstName,
    lastName: e.lastName,
  }));

  const activeTypes = ts.filter((t) => t.status === 'active');

  return <ApplyLeaveClient initialTypes={activeTypes} initialEmployees={employees} initialBalances={bs} />;
}

export default function ApplyLeavePage() {
  return (
    <EntityListShell
      title="Apply for Leave"
      subtitle="Submit a leave application for an employee."
    >
      <Card className="p-6">
        <Suspense
          fallback={
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
              Loading form…
            </div>
          }
        >
          <ApplyLeaveLoader />
        </Suspense>
      </Card>
    </EntityListShell>
  );
}
