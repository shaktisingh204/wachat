/**
 * SabFlow presence (polling-based).
 *
 *   POST /api/sabflow/[flowId]/presence
 *        body: { cursor?: { x, y } }
 *        → records / refreshes a heartbeat for the caller.
 *        → returns { you, others } so the editor can render avatars
 *          without a separate GET round-trip.
 *
 * Clients should POST every 5 s while the editor is open.  Entries TTL out
 * after 15 s of silence.
 *
 * Single-process state — see lib/sabflow/presence/store.ts for the swap
 * point if multi-instance presence becomes needed.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  heartbeat,
  leave,
  listPresence,
  type PresenceEntry,
} from '@/lib/sabflow/presence/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SessionUser = {
  _id?: { toString(): string };
  id?: string;
  name?: string;
  email?: string;
  image?: string;
};

function resolveUser(session: { user?: unknown } | null): SessionUser | null {
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ flowId: string }> },
) {
  try {
    const session = await getSession();
    const user = resolveUser(session);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = user._id?.toString() ?? user.id ?? '';
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    const { flowId } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as {
      cursor?: { x: number; y: number };
    };

    const entry: PresenceEntry = {
      userId,
      name: user.name ?? user.email ?? userId,
      avatarUrl: user.image,
      cursor: body.cursor,
      lastSeen: Date.now(),
    };
    heartbeat(flowId, entry);

    return NextResponse.json({
      you: entry,
      others: listPresence(flowId, userId),
    });
  } catch (err) {
    console.error('[SABFLOW PRESENCE POST] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ flowId: string }> },
) {
  try {
    const session = await getSession();
    const user = resolveUser(session);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = user._id?.toString() ?? user.id ?? '';
    const { flowId } = await ctx.params;
    leave(flowId, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[SABFLOW PRESENCE DELETE] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
