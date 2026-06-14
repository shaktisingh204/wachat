'use server';

/**
 * Mints a short-lived WebSocket ticket for the SabChat agent realtime
 * socket (`/v1/sabchat/ws`).
 *
 * Browsers can't set an `Authorization` header on a `new WebSocket()`
 * handshake, so the agent client passes this token as a `?token=` query
 * param; the sabchat-ws crate promotes it into the header before the
 * `AuthUser` extractor runs (see `rust/crates/sabchat-ws/src/lib.rs`).
 *
 * The token is a normal 15-minute Rust JWT scoped to the **active project**
 * (`tid = workspaceId`) so the socket only ever sees that project's events.
 * The client re-fetches a fresh ticket on every (re)connect.
 */

import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getSession } from '@/app/actions/user.actions';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';

export type SabchatWsTicket =
  | { ok: true; url: string; token: string }
  | { ok: false; error: string };

/** Resolve the browser-facing WebSocket base URL from the Rust API base. */
function wsBaseUrl(): string {
  const httpBase =
    process.env.NEXT_PUBLIC_RUST_API_URL ||
    process.env.RUST_API_URL ||
    'http://localhost:8080';
  // http→ws, https→wss.
  return httpBase.replace(/^http/i, 'ws');
}

export async function getSabchatWsTicket(): Promise<SabchatWsTicket> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) return { ok: false, error: 'No active SabChat project selected.' };

  const session = await getSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  try {
    const token = await issueRustJwt({
      userId: String(userId),
      tenantId: wsId,
      roles: [],
    });
    return { ok: true, url: `${wsBaseUrl()}/v1/sabchat/ws`, token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not mint ws ticket.' };
  }
}
