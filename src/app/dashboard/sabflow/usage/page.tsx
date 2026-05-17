/**
 * /dashboard/sabflow/usage — workspace usage stats.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { UsageClient } from './_components/usage-client';

export const dynamic = 'force-dynamic';

export default function UsagePage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <UsageClient />
      </Suspense>
    </div>
  );
}
