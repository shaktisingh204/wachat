import * as React from 'react';
import KpiTrackingClient from './client';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmKpis } from '@/app/actions/crm-hr-appraisals.actions';

export const dynamic = 'force-dynamic';

async function KpiLoader() {
  const data = await getCrmKpis();
  return <KpiTrackingClient initialData={Array.isArray(data) ? data : []} />;
}

export default function KpiTrackingPage() {
  return (
    <React.Suspense fallback={<div className="p-4 text-sm text-zoru-ink-muted">Loading KPIs...</div>}>
      <KpiLoader />
    </React.Suspense>
  );
}
