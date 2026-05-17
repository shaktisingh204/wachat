/**
 * /dashboard/sabflow/[flowId]/webhooks
 *
 * Lists every webhook trigger registered for the flow with its public URL,
 * status, and last-activity timestamp.  Read-only for now — regeneration
 * is a follow-up.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { WebhooksClient } from './_components/webhooks-client';

export const dynamic = 'force-dynamic';

export default async function FlowWebhooksPage({
  params,
}: {
  params: Promise<{ flowId: string }>;
}) {
  const { flowId } = await params;
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <WebhooksClient flowId={flowId} />
      </Suspense>
    </div>
  );
}
