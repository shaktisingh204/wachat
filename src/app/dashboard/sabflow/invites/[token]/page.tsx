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
  redirect } from "next/navigation";

import { getSession } from "@/app/actions/user.actions";
import {
  getInviteByToken,
  getWorkspaceById,
  } from "@/lib/sabflow/workspaces/db";

/**
 * /dashboard/sabflow/invites/[token]
 *
 * Lets a logged-in user accept or decline a workspace invite. On accept the
 * user is redirected to the workspace's settings page.
 *
 * ZoruUI rewrite — chrome only. Auth/data flow unchanged.
 */

import { CircleAlert, Hourglass, MailX } from "lucide-react";

import { InviteAcceptClient } from "./invite-accept-client";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();

  if (!session?.user) {
    const next = encodeURIComponent(`/dashboard/sabflow/invites/${token}`);
    redirect(`/login?next=${next}`);
  }

  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <InvitePanel>
        <EmptyState
          icon={<MailX />}
          title="Invite not found"
          description="This invite link is invalid or has been revoked."
        />
      </InvitePanel>
    );
  }

  if (invite.acceptedAt) {
    return (
      <InvitePanel>
        <EmptyState
          icon={<CircleAlert />}
          title="Invite already used"
          description="This invite has already been accepted."
        />
      </InvitePanel>
    );
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    return (
      <InvitePanel>
        <EmptyState
          icon={<Hourglass />}
          title="Invite expired"
          description="Ask the workspace admin to send you a new invite."
        />
      </InvitePanel>
    );
  }

  const workspace = await getWorkspaceById(invite.workspaceId);

  const sessionEmail =
    typeof session.user.email === "string"
      ? session.user.email.trim().toLowerCase()
      : "";
  const emailMismatch = Boolean(
    sessionEmail && sessionEmail !== invite.email.toLowerCase(),
  );

  return (
    <InvitePanel>
      <InviteAcceptClient
        token={token}
        inviteEmail={invite.email}
        inviteRole={invite.role}
        workspaceId={invite.workspaceId}
        workspaceName={workspace?.name ?? "a workspace"}
        workspaceIconUrl={workspace?.iconUrl}
        invitedBy={invite.invitedBy}
        emailMismatch={emailMismatch}
        sessionEmail={sessionEmail}
      />
    </InvitePanel>
  );
}

function InvitePanel({ children }: { children: React.ReactNode }) {
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
            <ZoruBreadcrumbPage>Workspace invite</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
