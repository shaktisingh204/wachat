/**
 * SabMail collaborative-drafting WS token endpoint (Tier 2, optional).
 *
 * Mints a short-lived HS256 JWT the browser hands to the Yjs sync gateway
 * (`services/sabflow-ws`) over the WebSocket subprotocol. The gateway is a
 * box-only sidecar; when it (or `JWT_SECRET`) isn't configured this route
 * returns 503 and the composer silently falls back to presence-only
 * collision detection — i.e. collaborative drafting is degrade-safe.
 *
 * Claim layout matches the gateway's `WsAuthClaims` (see
 * `services/sabflow-ws/src/auth.ts`):
 *   sub = userId · ws = SabMail workspaceId · roles · jti · exp (≤120s) · iat
 *
 * The workspace is the caller's *validated* SabMail project, so a token only
 * ever scopes a room to a mail workspace the user actually belongs to.
 */

import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { randomUUID } from 'crypto';

import { getSession } from '@/app/actions/user.actions';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';

export const dynamic = 'force-dynamic';

/** Token lifetime — well under the gateway's 120s ceiling. */
const TTL_SECONDS = 90;

function collabEnabled(): boolean {
  return (
    process.env.SABMAIL_COLLAB_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_SABMAIL_COLLAB_ENABLED === 'true'
  );
}

export async function GET(req: Request) {
  // Degrade signal: feature flag off or no signing secret → no real-time tier.
  const secretRaw = process.env.JWT_SECRET;
  if (!collabEnabled() || !secretRaw) {
    return NextResponse.json(
      { error: 'collab-disabled' },
      { status: 503 },
    );
  }

  const session = await getSession();
  const userId = session?.user?._id ? String(session.user._id) : null;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: 'no-workspace' }, { status: 403 });
  }

  // docId is informational here (the gateway rooms by workspaceId:docId from the
  // query string); we accept it for parity with the SabFlow client contract.
  const url = new URL(req.url);
  const docId = url.searchParams.get('docId') ?? '';

  const secret = new TextEncoder().encode(secretRaw);
  const token = await new SignJWT({ ws: workspaceId, roles: ['editor'], doc: docId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret);

  return NextResponse.json(
    { token, workspaceId, docId },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
