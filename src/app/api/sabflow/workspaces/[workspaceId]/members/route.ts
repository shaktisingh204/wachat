/**
 * GET  /api/sabflow/workspaces/[workspaceId]/members
 *   Lists members of a workspace (any member may view).
 *
 * POST /api/sabflow/workspaces/[workspaceId]/members
 *   Directly add a member by userId. Owner / admin only.
 *   Body: { userId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  addWorkspaceMember,
  getMemberRole,
  getWorkspaceMembers,
} from '@/lib/sabflow/workspaces/db';
import {
  canManageMembers,
  canViewFlow,
} from '@/lib/sabflow/workspaces/permissions';
import type { WorkspaceRole } from '@/lib/sabflow/workspaces/types';

export const dynamic = 'force-dynamic';

const VALID_ROLES: WorkspaceRole[] = ['owner', 'admin', 'editor', 'viewer'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { workspaceId } = await params;
  const role = await getMemberRole(workspaceId, session.user._id.toString());
  if (!canViewFlow(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const members = await getWorkspaceMembers(workspaceId);
  return NextResponse.json({ members });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { workspaceId } = await params;
  const role = await getMemberRole(workspaceId, session.user._id.toString());
  if (!canManageMembers(role)) {
    return NextResponse.json(
      { error: 'Only admins and owners can add members' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: unknown;
    role?: unknown;
  };
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const newRole =
    typeof body.role === 'string' &&
    (VALID_ROLES as string[]).includes(body.role)
      ? (body.role as WorkspaceRole)
      : null;

  if (!userId || !newRole) {
    return NextResponse.json(
      { error: 'userId and a valid role are required' },
      { status: 400 },
    );
  }

  // Only owners may create other owners.
  if (newRole === 'owner' && role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the owner can assign the owner role' },
      { status: 403 },
    );
  }

  await addWorkspaceMember({
    workspaceId,
    userId,
    role: newRole,
    invitedBy: session.user._id.toString(),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
