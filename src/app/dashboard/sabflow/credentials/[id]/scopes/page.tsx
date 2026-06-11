/**
 * /dashboard/sabflow/credentials/[id]/scopes — per-credential access matrix.
 * Thin server shell; loading, the scope grid, and persistence against
 * /api/sabflow/credentials/[id]/scopes live in `ScopesClient`, which renders
 * its own header, so the frame passes breadcrumb only.
 */

import { Suspense } from 'react';

import { Spinner } from '@/components/sabcrm/20ui';

import { ScopesClient } from './_components/scopes-client';
import { SabflowPage, SABFLOW_CRUMBS } from '../../../_components/sabflow-page';

export default async function CredentialScopesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SabflowPage
      breadcrumb={[
        ...SABFLOW_CRUMBS,
        { label: 'Connections', href: '/dashboard/sabflow/connections' },
        { label: 'Scopes' },
      ]}
    >
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading scopes" />
          </div>
        }
      >
        <ScopesClient credentialId={id} />
      </Suspense>
    </SabflowPage>
  );
}
