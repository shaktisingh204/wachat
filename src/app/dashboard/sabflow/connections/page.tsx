/**
 * SabFlow — Connections.
 *
 * Connections IS the credentials manager: this server shell frames the page
 * (SabflowPage breadcrumb + header) and the client component does the real
 * work against /api/sabflow/credentials.
 */

import { Suspense } from 'react';

import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { ConnectionsClient } from './_components/connections-client';

export const metadata = {
  title: 'Connections | SabFlow',
};

export default function ConnectionsPage() {
  return (
    <SabflowPage
      breadcrumb={[...SABFLOW_CRUMBS, { label: 'Connections' }]}
      title="Connections"
      description="Credentials for every provider your flows talk to — create, test, and manage them here."
    >
      <Suspense fallback={null}>
        <ConnectionsClient />
      </Suspense>
    </SabflowPage>
  );
}
