/**
 * /dashboard/sabflow/workspaces/[workspaceId]/settings
 *
 * Server page that loads the workspace and the viewer's role, then mounts
 * the client `WorkspaceSettingsPage`. Unauthenticated users are redirected
 * to sign-in. Non-members get a 403 stub.
 */

import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import {
  getMemberRole,
  getWorkspaceById,
} from '@/lib/sabflow/workspaces/db';
import { WorkspaceSettingsPage } from '@/components/sabflow/workspaces/WorkspaceSettingsPage';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  const [workspace, role] = await Promise.all([
    getWorkspaceById(workspaceId),
    getMemberRole(workspaceId, session.user._id.toString()),
  ]);

  if (!workspace) notFound();

  if (!role) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Access denied
        </h1>
        <p className="text-[13px] text-gray-500">
          You are not a member of this workspace.
        </p>
      </div>
    );
  }

  return (
    <WorkspaceSettingsPage
      workspaceId={workspaceId}
      initialWorkspace={workspace}
      currentUserRole={role}
      currentUserId={session.user._id.toString()}
    />
  );
}
