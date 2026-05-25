import { Suspense } from 'react';
import LeaveSettingsClient from './client';
import { getLeaveSettings } from '@/app/actions/worksuite/leave.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

async function LeaveSettingsLoader() {
  const s = await getLeaveSettings();
  return <LeaveSettingsClient initialSettings={s} />;
}

export default function LeaveSettingsPage() {
  return (
    <EntityListShell
      title="Leave Settings"
      subtitle="Configure how leave applications behave across the organization."
    >
      <Card className="p-6">
        <Suspense
          fallback={
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
              Loading…
            </div>
          }
        >
          <LeaveSettingsLoader />
        </Suspense>
      </Card>
    </EntityListShell>
  );
}
