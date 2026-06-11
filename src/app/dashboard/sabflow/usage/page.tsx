/**
 * /dashboard/sabflow/usage — workspace usage stats.
 *
 * The client renders its own PageHeader, so the SabflowPage frame only
 * contributes the breadcrumb + width/gutter.
 */

import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { UsageClient } from './_components/usage-client';

export const dynamic = 'force-dynamic';

export default function UsagePage() {
  return (
    <SabflowPage breadcrumb={[...SABFLOW_CRUMBS, { label: 'Usage' }]}>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading usage" />
          </div>
        }
      >
        <UsageClient />
      </Suspense>
    </SabflowPage>
  );
}
