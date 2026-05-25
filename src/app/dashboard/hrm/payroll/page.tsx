import { Suspense } from 'react';
import PayrollRunClient from './client';
import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { startOfMonth } from 'date-fns';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const dynamic = 'force-dynamic';

async function PayrollLoader() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const period = startOfMonth(new Date(year, month));

  const [payslipsData, employeesData] = await Promise.all([
    getPayslips(period),
    getCrmEmployees(),
  ]);

  return (
    <PayrollRunClient
      initialPayslips={payslipsData as any}
      initialEmployees={employeesData as any}
      initialMonth={month}
      initialYear={year}
    />
  );
}

export default function PayrollRunPage() {
  return (
    <Suspense
      fallback={
        <EntityListShell
          title="Run Payroll"
          subtitle="Loading payroll data..."
        >
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">Loading…</div>
        </EntityListShell>
      }
    >
      <PayrollLoader />
    </Suspense>
  );
}
