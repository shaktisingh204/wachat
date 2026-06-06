import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";

import { getSession } from "@/app/actions/user.actions";
import {
  getMemberRole,
  getWorkspaceById,
  } from "@/lib/sabflow/workspaces/db";
import { WorkspaceSettingsPage } from "@/components/sabflow/workspaces/WorkspaceSettingsPage";

/**
 * /dashboard/sabflow/workspaces/[workspaceId]/settings
 *
 * Server page that loads the workspace and the viewer's role, then mounts
 * the client `WorkspaceSettingsPage` (shared composite — kept opaque).
 * Unauthenticated users are redirected to sign-in. Non-members get a 403
 * stub rendered with ZoruUI primitives.
 */

import React, { Suspense } from 'react';
import WorkspaceSettingsLoading from './loading';

export const dynamic = "force-dynamic";

async function WorkspaceSettingsData({ workspaceId }: { workspaceId: string }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const [workspace, role] = await Promise.all([
    getWorkspaceById(workspaceId),
    getMemberRole(workspaceId, session.user._id.toString()),
  ]);

  if (!workspace) notFound();

  if (!role) {
    return (
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
        <Breadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard/sabflow/flow-builder">
                SabFlow
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Workspace</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>

        <EmptyState
          icon={<ShieldOff />}
          title="Access denied"
          description="You are not a member of this workspace."
        />
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

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <Suspense fallback={<WorkspaceSettingsLoading />}>
      <WorkspaceSettingsData workspaceId={workspaceId} />
    </Suspense>
  );
}
