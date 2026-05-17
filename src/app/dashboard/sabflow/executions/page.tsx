/**
 * /dashboard/sabflow/executions — list of recent flow executions.
 *
 * Thin server shell; the interactive list lives in `ExecutionsListClient`.
 * Filtering by flow / status / trigger mode happens client-side because
 * this page is dynamic (auth-gated) — no caching benefit from RSC fetches.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { ExecutionsListClient } from './_components/executions-list-client';

export const dynamic = 'force-dynamic';

export default function ExecutionsPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <ExecutionsListClient />
      </Suspense>
    </div>
  );
}
