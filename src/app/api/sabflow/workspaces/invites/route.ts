/**
 * GET /api/sabflow/workspaces/invites
 *   The authenticated user's invite inbox + outbox.
 *
 *   - `incoming`: pending, non-expired invites addressed to the session
 *     user's email, enriched with the workspace name and inviter identity.
 *   - `sent`: pending invites across every workspace where the user may
 *     manage members (owner / admin), enriched with the workspace name.
 *
 *   Response: { incoming: IncomingInvite[]; sent: SentInvite[] }
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  getInvitesByEmail,
  getInvitesByWorkspace,
  getMemberRole,
  getWorkspaceById,
  getWorkspacesByUser,
} from '@/lib/sabflow/workspaces/db';
import { canManageMembers } from '@/lib/sabflow/workspaces/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const userId = session.user._id.toString();
    const email =
      typeof session.user.email === 'string'
        ? session.user.email.trim().toLowerCase()
        : '';

    const [rawIncoming, workspaces] = await Promise.all([
      email ? getInvitesByEmail(email) : Promise.resolve([]),
      getWorkspacesByUser(userId),
    ]);

    // Workspace names for incoming invites — the user usually isn't a member
    // of those workspaces yet, so look up the ones we don't already have.
    const wsNameById = new Map(workspaces.map((w) => [w.id, w.name]));
    const unknownIds = [...new Set(rawIncoming.map((i) => i.workspaceId))].filter(
      (id) => !wsNameById.has(id),
    );
    const lookedUp = await Promise.all(unknownIds.map((id) => getWorkspaceById(id)));
    for (const ws of lookedUp) {
      if (ws) wsNameById.set(ws.id, ws.name);
    }

    const incoming = rawIncoming.map((inv) => ({
      id: inv.id,
      token: inv.token,
      workspaceId: inv.workspaceId,
      workspaceName: wsNameById.get(inv.workspaceId) ?? 'a workspace',
      role: inv.role,
      invitedBy: inv.inviterEmail ?? inv.inviterName ?? '',
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    }));

    // Outbox: pending invites of every workspace the user can manage.
    const roles = await Promise.all(
      workspaces.map((w) => getMemberRole(w.id, userId)),
    );
    const manageable = workspaces.filter((_, i) => canManageMembers(roles[i]));
    const perWorkspace = await Promise.all(
      manageable.map((w) => getInvitesByWorkspace(w.id)),
    );
    const sent = manageable
      .flatMap((w, i) =>
        perWorkspace[i].map((inv) => ({
          id: inv.id,
          workspaceId: inv.workspaceId,
          workspaceName: w.name,
          email: inv.email,
          role: inv.role,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
        })),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    return NextResponse.json({ incoming, sent });
  } catch (err) {
    console.error('[sabflow/workspaces/invites GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
