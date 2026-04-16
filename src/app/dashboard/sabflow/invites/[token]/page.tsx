/**
 * /dashboard/sabflow/invites/[token]
 *
 * Lets a logged-in user accept or decline a workspace invite.
 * On accept the user is redirected to the workspace's settings page.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import {
  getInviteByToken,
  getWorkspaceById,
} from '@/lib/sabflow/workspaces/db';
import { InviteAcceptClient } from './invite-accept-client';

export const dynamic = 'force-dynamic';

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
      <InvitePanel title="Invite not found">
        <p className="text-[13px] text-gray-500">
          This invite link is invalid or has been revoked.
        </p>
      </InvitePanel>
    );
  }

  if (invite.acceptedAt) {
    return (
      <InvitePanel title="Invite already used">
        <p className="text-[13px] text-gray-500">
          This invite has already been accepted.
        </p>
      </InvitePanel>
    );
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    return (
      <InvitePanel title="Invite expired">
        <p className="text-[13px] text-gray-500">
          Ask the workspace admin to send you a new invite.
        </p>
      </InvitePanel>
    );
  }

  const workspace = await getWorkspaceById(invite.workspaceId);

  const sessionEmail =
    typeof session.user.email === 'string'
      ? session.user.email.trim().toLowerCase()
      : '';
  const emailMismatch = Boolean(
    sessionEmail && sessionEmail !== invite.email.toLowerCase(),
  );

  return (
    <InviteAcceptClient
      token={token}
      inviteEmail={invite.email}
      inviteRole={invite.role}
      workspaceId={invite.workspaceId}
      workspaceName={workspace?.name ?? 'a workspace'}
      workspaceIconUrl={workspace?.iconUrl}
      invitedBy={invite.invitedBy}
      emailMismatch={emailMismatch}
      sessionEmail={sessionEmail}
    />
  );
}

function InvitePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h1>
      {children}
    </div>
  );
}
