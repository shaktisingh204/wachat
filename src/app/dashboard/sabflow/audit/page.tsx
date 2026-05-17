/**
 * /dashboard/sabflow/audit — workspace audit log timeline.
 *
 * Thin server shell; the interactive list lives in `AuditClient`.
 * Filtering, paging, and expansion happens client-side because the
 * page is dynamic (auth-gated) — no caching benefit from RSC fetches.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { AuditClient } from './_components/audit-client';

export const dynamic = 'force-dynamic';

export default function AuditPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <AuditClient />
      </Suspense>
    </div>
  );
}
