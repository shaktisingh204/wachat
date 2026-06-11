/**
 * /dashboard/sabflow/executions/[executionId] — step-by-step replay of a past
 * execution. Thin server shell; all data loading (REST + live SSE) lives in
 * `ExecutionReplayClient`, which renders its own header (flow name, status,
 * duration), so the frame passes breadcrumb only.
 */

import { Suspense } from 'react';

import { Spinner } from '@/components/sabcrm/20ui';

import { ExecutionReplayClient } from '../_components/execution-replay-client';
import { SabflowPage, SABFLOW_CRUMBS } from '../../_components/sabflow-page';

export default async function ExecutionReplayPage({
  params,
}: {
  params: Promise<{ executionId: string }>;
}) {
  const { executionId } = await params;

  return (
    <SabflowPage
      width="wide"
      breadcrumb={[
        ...SABFLOW_CRUMBS,
        { label: 'Executions', href: '/dashboard/sabflow/executions' },
        { label: 'Replay' },
      ]}
    >
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading execution" />
          </div>
        }
      >
        <ExecutionReplayClient executionId={executionId} />
      </Suspense>
    </SabflowPage>
  );
}
