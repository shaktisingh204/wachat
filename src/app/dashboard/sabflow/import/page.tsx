/**
 * /dashboard/sabflow/import — bring flows in from SabFlow JSON, n8n, or
 * Typebot exports. Thin server shell; upload, validation preview, and the
 * actual POSTs to /api/sabflow/import* live in `ImportClient`, which renders
 * its own header, so the frame passes breadcrumb only.
 */

import { Suspense } from 'react';

import { Spinner } from '@/components/sabcrm/20ui';

import { ImportClient } from './_components/import-client';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';

export default function SabFlowImportPage() {
  return (
    <SabflowPage breadcrumb={[...SABFLOW_CRUMBS, { label: 'Import' }]}>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading importer" />
          </div>
        }
      >
        <ImportClient />
      </Suspense>
    </SabflowPage>
  );
}
