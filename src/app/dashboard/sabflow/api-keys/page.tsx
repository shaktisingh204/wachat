/**
 * /dashboard/sabflow/api-keys — manage SabFlow API keys.
 *
 * Thin server shell; the interactive table + create/revoke modals live in
 * `ApiKeysClient`.  Page is force-dynamic (auth-gated, mutation-heavy) so
 * there's no caching benefit from RSC fetches — all data flows from the
 * `/api/sabflow/api-keys` route handler.
 *
 * The client renders its own PageHeader, so the SabflowPage frame only
 * contributes the breadcrumb + width/gutter.
 */

import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { ApiKeysClient } from './_components/api-keys-client';

export const dynamic = 'force-dynamic';

export default function ApiKeysPage() {
  return (
    <SabflowPage breadcrumb={[...SABFLOW_CRUMBS, { label: 'API keys' }]}>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading API keys" />
          </div>
        }
      >
        <ApiKeysClient />
      </Suspense>
    </SabflowPage>
  );
}
