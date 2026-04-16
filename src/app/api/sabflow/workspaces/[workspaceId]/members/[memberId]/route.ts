/**
 * PATCH  /api/sabflow/workspaces/[workspaceId]/members/[memberId]
 *   Update a member's role. Owner / admin only.
 *   Body: { role: 'owner' | 'admin' | 'editor' | 'viewer' }
 *
 * DELETE /api/sabflow/workspaces/[workspaceId]/members/[memberId]
 *   Remove a member. Owner / admin only. Members may also remove themselves.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import {
  getMemberRole,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/lib/sabflow/workspaces/db';
import { canManageMembers } from '@/lib/sabflow/workspaces/permissions';
import type { WorkspaceRole } from '@/lib/sabflow/workspaces/types';

export const dynamic = 'force-dynamic';

const VALID_ROLES: WorkspaceRole[] = ['owner', 'admin', 'editor', 'viewer'];

interface MemberLookupDoc {
  _id: ObjectId;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

async function loadMember(
  memberId: string,
): Promise<MemberLookupDoc | null> {
  if (!ObjectId.isValid(memberId)) return null;
  const { db } = await connectToDatabase();
  return db
    .collection<MemberLookupDoc>('sabflow_workspace_members')
    .findOne({ _id: new ObjectId(memberId) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { workspaceId, memberId } = await params;
  const callerRole = await getMemberRole(
    workspaceId,
    session.user._id.toString(),
  );
  if (!canManageMembers(callerRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const target = await loadMember(memberId);
  if (!target || target.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { role?: unknown };
  const newRole =
    typeof body.role === 'string' &&
    (VALID_ROLES as string[]).includes(body.role)
      ? (body.role as WorkspaceRole)
      : null;
  if (!newRole) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Only the owner may promote to owner or demote another owner.
  if ((newRole === 'owner' || target.role === 'owner') && callerRole !== 'owner') {
    return NextResponse.json(
      { error: 'Only the workspace owner can change the owner role' },
      { status: 403 },
    );
  }

  await updateWorkspaceMemberRole(memberId, newRole);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { workspaceId, memberId } = await params;
  const callerUserId = session.user._id.toString();
  const callerRole = await getMemberRole(workspaceId, callerUserId);

  const target = await loadMember(memberId);
  if (!target || target.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const isSelf = target.userId === callerUserId;
  if (!isSelf && !canManageMembers(callerRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent removing the owner — they must first transfer ownership.
  if (target.role === 'owner') {
    return NextResponse.json(
      { error: 'Cannot remove the workspace owner. Transfer ownership first.' },
      { status: 400 },
    );
  }

  await removeWorkspaceMember(memberId);
  return NextResponse.json({ ok: true });
}
