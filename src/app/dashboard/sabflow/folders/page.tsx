import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { FoldersClient } from './_components/folders-client';

export default function FoldersPage() {
  return (
    <SabflowPage
      breadcrumb={[...SABFLOW_CRUMBS, { label: 'Folders' }]}
      title="Folders"
      description="Organise your flows into colour-coded folders. Flows can be moved in and out at any time."
    >
      <Suspense fallback={<Spinner />}>
        <FoldersClient />
      </Suspense>
    </SabflowPage>
  );
}
