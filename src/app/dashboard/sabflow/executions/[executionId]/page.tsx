/**
 * /dashboard/sabflow/executions/[executionId] — replay view.
 *
 * Renders the node-by-node timeline for a single past execution.  Uses the
 * existing `ExecutionHistoryEntry.nodes` array (input / output / status /
 * duration / error per node) populated by the engine.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { ExecutionReplayClient } from '../_components/execution-replay-client';

export const dynamic = 'force-dynamic';

export default async function ExecutionReplayPage({
  params,
}: {
  params: Promise<{ executionId: string }>;
}) {
  const { executionId } = await params;
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <ExecutionReplayClient executionId={executionId} />
      </Suspense>
    </div>
  );
}
