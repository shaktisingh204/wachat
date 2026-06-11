/**
 * /dashboard/sabflow/health — at-a-glance ops view of SabFlow's deps.
 *
 * Thin server shell; the polling client lives in `HealthClient`.  Marked
 * `force-dynamic` because the underlying check is real-time and should
 * never be cached (any caching defeats the purpose of a health probe).
 *
 * The client renders its own PageHeader, so the SabflowPage frame only
 * contributes the breadcrumb + width/gutter.
 */

import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { HealthClient } from './_components/health-client';

export const dynamic = 'force-dynamic';

export default function HealthPage() {
  return (
    <SabflowPage breadcrumb={[...SABFLOW_CRUMBS, { label: 'Health' }]}>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading health status" />
          </div>
        }
      >
        <HealthClient />
      </Suspense>
    </SabflowPage>
  );
}
