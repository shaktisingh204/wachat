/**
 * DELETE /api/sabflow/workspaces/[workspaceId]/invites/[inviteId]
 *   Revoke a pending invite. Owner / admin only.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  deleteInvite,
  getInviteById,
  getMemberRole,
} from '@/lib/sabflow/workspaces/db';
import { canManageMembers } from '@/lib/sabflow/workspaces/permissions';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; inviteId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { workspaceId, inviteId } = await params;
  const role = await getMemberRole(workspaceId, session.user._id.toString());
  if (!canManageMembers(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const invite = await getInviteById(inviteId);
  if (!invite || invite.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }
  await deleteInvite(inviteId);
  return NextResponse.json({ ok: true });
}
