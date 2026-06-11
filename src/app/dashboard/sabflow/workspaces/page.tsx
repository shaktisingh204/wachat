import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { listSabFlowWorkspaces } from './actions';
import { WorkspacesClient } from './_components/workspaces-client';

export const metadata = {
  title: 'SabFlow Workspaces | SabNode',
};

export const dynamic = 'force-dynamic';

async function WorkspacesData() {
  const initialData = await listSabFlowWorkspaces('', 1);
  return <WorkspacesClient initialData={initialData} />;
}

export default function SabFlowWorkspacesPage() {
  return (
    <SabflowPage breadcrumb={[...SABFLOW_CRUMBS, { label: 'Workspaces' }]}>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading workspaces" />
          </div>
        }
      >
        <WorkspacesData />
      </Suspense>
    </SabflowPage>
  );
}
