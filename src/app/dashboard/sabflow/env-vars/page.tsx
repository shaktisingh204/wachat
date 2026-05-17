/**
 * /dashboard/sabflow/env-vars — workspace environment variables manager.
 *
 * Thin server shell; the CRUD UI lives in `EnvVarsClient` since the page is
 * dynamic (auth-gated) and all data is fetched client-side from the
 * /api/sabflow/env-vars endpoints.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { EnvVarsClient } from './_components/env-vars-client';

export const dynamic = 'force-dynamic';

export default function EnvVarsPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <EnvVarsClient />
      </Suspense>
    </div>
  );
}
