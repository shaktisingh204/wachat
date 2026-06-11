/**
 * /dashboard/sabflow/[flowId]/webhooks
 *
 * Lists every webhook trigger registered for the flow with its public URL,
 * status, and last-activity timestamp.  Read-only for now — regeneration
 * is a follow-up.
 *
 * The client renders its own PageHeader, so the SabflowPage frame only
 * contributes the breadcrumb + width/gutter.
 */

import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../../_components/sabflow-page';
import { WebhooksClient } from './_components/webhooks-client';

export const dynamic = 'force-dynamic';

export default async function FlowWebhooksPage({
  params,
}: {
  params: Promise<{ flowId: string }>;
}) {
  const { flowId } = await params;
  return (
    <SabflowPage breadcrumb={[...SABFLOW_CRUMBS, { label: 'Webhooks' }]}>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading webhooks" />
          </div>
        }
      >
        <WebhooksClient flowId={flowId} />
      </Suspense>
    </SabflowPage>
  );
}
