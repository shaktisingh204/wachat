import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { ExecutionsListClient } from './_components/executions-list-client';

export default function ExecutionsPage() {
  return (
    <SabflowPage
      breadcrumb={[...SABFLOW_CRUMBS, { label: 'Executions' }]}
      title="Executions"
      description="Monitor and debug every automated workflow run, with per-node detail and replay."
    >
      <Suspense fallback={<Spinner />}>
        <ExecutionsListClient />
      </Suspense>
    </SabflowPage>
  );
}
