/**
 * GET  /api/sabflow/workspaces/[workspaceId]/invites
 *   Lists pending invites (not yet accepted). Owner / admin only.
 *
 * POST /api/sabflow/workspaces/[workspaceId]/invites
 *   Create an invite for `email` with `role`. Owner / admin only.
 *   Body: { email: string; role: 'admin' | 'editor' | 'viewer' }
 *   Response: { invite, inviteUrl }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  createInvite,
  getInvitesByWorkspace,
  getMemberRole,
} from '@/lib/sabflow/workspaces/db';
import { canManageMembers } from '@/lib/sabflow/workspaces/permissions';
import type { WorkspaceRole } from '@/lib/sabflow/workspaces/types';

export const dynamic = 'force-dynamic';

const INVITABLE_ROLES: WorkspaceRole[] = ['admin', 'editor', 'viewer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!canManageMembers(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const invites = await getInvitesByWorkspace(workspaceId);
  return NextResponse.json({ invites });
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    role?: unknown;
  };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const inviteRole =
    typeof body.role === 'string' &&
    (INVITABLE_ROLES as string[]).includes(body.role)
      ? (body.role as WorkspaceRole)
      : null;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!inviteRole) {
    return NextResponse.json(
      { error: 'Role must be one of admin, editor, viewer' },
      { status: 400 },
    );
  }

  const invite = await createInvite({
    workspaceId,
    email,
    role: inviteRole,
    invitedBy: session.user._id.toString(),
  });

  const origin = request.nextUrl.origin;
  const inviteUrl = `${origin}/dashboard/sabflow/invites/${invite.token}`;

  return NextResponse.json({ invite, inviteUrl }, { status: 201 });
}
