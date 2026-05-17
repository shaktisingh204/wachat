/**
 * /dashboard/sabflow/api-keys — manage SabFlow API keys.
 *
 * Thin server shell; the interactive table + create/revoke modals live in
 * `ApiKeysClient`.  Page is force-dynamic (auth-gated, mutation-heavy) so
 * there's no caching benefit from RSC fetches — all data flows from the
 * `/api/sabflow/api-keys` route handler.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { ApiKeysClient } from './_components/api-keys-client';

export const dynamic = 'force-dynamic';

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <ApiKeysClient />
      </Suspense>
    </div>
  );
}
