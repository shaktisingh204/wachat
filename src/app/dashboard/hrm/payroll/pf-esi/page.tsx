import { Suspense } from 'react';
import PfEsiClient from './client';
import { getComplianceData } from './actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const dynamic = 'force-dynamic';

async function PfEsiLoader() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const initialData = await getComplianceData(month, year);

  return (
    <PfEsiClient
      initialRows={initialData}
      initialMonth={month}
      initialYear={year}
    />
  );
}

export default function PfEsiPage() {
  return (
    <Suspense
      fallback={
        <EntityListShell
          title="PF & ESI Compliance"
          subtitle="Loading compliance data..."
        >
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">Loading…</div>
        </EntityListShell>
      }
    >
      <PfEsiLoader />
    </Suspense>
  );
}
