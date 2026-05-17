/**
 * /dashboard/sabflow/health — at-a-glance ops view of SabFlow's deps.
 *
 * Thin server shell; the polling client lives in `HealthClient`.  Marked
 * `force-dynamic` because the underlying check is real-time and should
 * never be cached (any caching defeats the purpose of a health probe).
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { HealthClient } from './_components/health-client';

export const dynamic = 'force-dynamic';

export default function HealthPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <HealthClient />
      </Suspense>
    </div>
  );
}
