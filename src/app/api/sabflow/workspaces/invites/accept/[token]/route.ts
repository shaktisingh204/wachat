/**
 * POST /api/sabflow/workspaces/invites/accept/[token]
 *   Accept an invite as the currently-logged-in user. The invite's email
 *   must match the session user's email for the accept to succeed.
 *   Response 200: { workspaceId: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  acceptInvite,
  getInviteByToken,
} from '@/lib/sabflow/workspaces/db';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { token } = await params;
  const invite = await getInviteByToken(token);
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json(
      { error: 'This invite has already been used' },
      { status: 400 },
    );
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
  }

  const sessionEmail =
    typeof session.user.email === 'string'
      ? session.user.email.trim().toLowerCase()
      : '';
  if (sessionEmail && sessionEmail !== invite.email.toLowerCase()) {
    return NextResponse.json(
      {
        error: `This invite was sent to ${invite.email}. Please sign in with that email.`,
      },
      { status: 403 },
    );
  }

  try {
    await acceptInvite(token, session.user._id.toString());
    return NextResponse.json({ workspaceId: invite.workspaceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to accept invite';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
