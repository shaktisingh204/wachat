import { Suspense } from 'react';
import { listSabFlowWorkspaces } from './actions';
import { WorkspacesClient } from './_components/workspaces-client';
import SabFlowWorkspacesLoading from './loading';

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <Suspense fallback={<SabFlowWorkspacesLoading />}>
        <WorkspacesData />
      </Suspense>
    </div>
  );
}
