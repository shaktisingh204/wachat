/**
 * DELETE /api/sabflow/workspaces/[workspaceId]/invites/[inviteId]
 *   Revoke a pending invite. Owner / admin — or the invitee themselves
 *   (declining an invite to a workspace they're not yet a member of).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  deleteInvite,
  getInviteById,
  getMemberRole,
} from '@/lib/sabflow/workspaces/db';
import { canManageMembers } from '@/lib/sabflow/workspaces/permissions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; inviteId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { workspaceId, inviteId } = await params;
  const invite = await getInviteById(inviteId);
  if (!invite || invite.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }
  const role = await getMemberRole(workspaceId, session.user._id.toString());
  const sessionEmail =
    typeof session.user.email === 'string' ? session.user.email.toLowerCase() : null;
  const isInvitee =
    sessionEmail !== null &&
    (invite as { email?: string }).email?.toLowerCase() === sessionEmail;
  if (!canManageMembers(role) && !isInvitee) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await deleteInvite(inviteId);

  void recordFlowAction('workspace.invite.revoked', {
    userId: session.user._id.toString(),
    workspaceId,
    target: inviteId,
    metadata: {
      inviteId,
      email: (invite as { email?: string }).email,
      role: (invite as { role?: string }).role,
    },
    request,
  });

  return NextResponse.json({ ok: true });
}
