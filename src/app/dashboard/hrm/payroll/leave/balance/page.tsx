import { Suspense } from 'react';
import LeaveBalanceClient from './client';
import {
  getLeaveBalance,
  getLeaveTypes,
} from '@/app/actions/worksuite/leave.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const dynamic = 'force-dynamic';

async function LeaveBalanceLoader() {
  const currentYear = new Date().getFullYear();
  const [balances, ts] = await Promise.all([
    getLeaveBalance(undefined, currentYear),
    getLeaveTypes(),
  ]);

  return <LeaveBalanceClient initialBalances={balances} initialTypes={ts} initialYear={currentYear} />;
}

export default function LeaveBalancePage() {
  return (
    <Suspense
      fallback={
        <EntityListShell
          title="Leave Balance"
          subtitle="Loading leave balances..."
        >
          <div className="text-center py-8 text-[var(--st-text-secondary)]">Loading…</div>
        </EntityListShell>
      }
    >
      <LeaveBalanceLoader />
    </Suspense>
  );
}
