import { listSabFlowWorkspaces } from './actions';
import { WorkspacesClient } from './_components/workspaces-client';

export const metadata = {
  title: 'SabFlow Workspaces | SabNode',
};

export default async function SabFlowWorkspacesPage() {
  const initialData = await listSabFlowWorkspaces('', 1);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <WorkspacesClient initialData={initialData} />
    </div>
  );
}
