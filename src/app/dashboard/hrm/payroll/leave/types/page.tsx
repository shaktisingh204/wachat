import { Suspense } from 'react';
import LeaveTypesClient from './client';
import { getLeaveTypes } from '@/app/actions/worksuite/leave.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function LeaveTypesLoader() {
  const ts = await getLeaveTypes();
  return <LeaveTypesClient initialTypes={ts as any} />;
}

export default function LeaveTypesPage() {
  return (
    <Suspense
      fallback={
        <EntityListShell
          title="Leave Types"
          subtitle="Loading leave types..."
        >
          <Card className="p-6">
            <div className="py-12 text-center text-[13px] text-[var(--st-text-secondary)]">Loading…</div>
          </Card>
        </EntityListShell>
      }
    >
      <LeaveTypesLoader />
    </Suspense>
  );
}
