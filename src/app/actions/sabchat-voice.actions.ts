'use server';

/**
 * SabChat voice/video call server actions — project-scoped over the
 * `sabchat-voice` Rust crate (`/v1/sabchat/voice/*`). This is the call
 * lifecycle + record layer (start / answer / end / token); the actual WebRTC
 * media is served by a separate media server (SFU/TURN) — see docs/sabchat/OPS.md.
 * The per-call `token` re-issues an access token for that media server.
 */

import { createHmac } from 'crypto';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { SabChatCall, SabChatCallKind, SabChatCallToken } from '@/lib/rust-client/sabchat-voice';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

export async function startCall(
  conversationId: string,
  kind: SabChatCallKind,
): Promise<{ ok: true; call: SabChatCall } | { ok: false; error: string }> {
  if (!conversationId) return { ok: false, error: 'No conversation selected.' };
  try {
    const call = await scoped(() => rustClient.sabchatVoice.start({ conversationId, kind }));
    return { ok: true, call };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function answerCall(
  callId: string,
): Promise<{ ok: true; call: SabChatCall } | { ok: false; error: string }> {
  try {
    const call = await scoped(() => rustClient.sabchatVoice.answer(callId));
    return { ok: true, call };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function endCall(
  callId: string,
): Promise<{ ok: true; call: SabChatCall } | { ok: false; error: string }> {
  try {
    const call = await scoped(() => rustClient.sabchatVoice.end(callId));
    return { ok: true, call };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Re-issue the media-server access token for an in-progress call. */
export async function getCallToken(
  callId: string,
): Promise<{ ok: true; token: SabChatCallToken } | { ok: false; error: string }> {
  try {
    const token = await scoped(() => rustClient.sabchatVoice.token({ callId }));
    return { ok: true, token };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/**
 * ICE/STUN-TURN config for the browser RTCPeerConnection.
 *
 * Always returns a public STUN server (works on the same LAN / with public
 * IPs). When a coturn relay is provisioned (`SABCHAT_TURN_URL`) it adds a TURN
 * entry. Auth prefers the **REST API time-limited credential** scheme — if
 * `SABCHAT_TURN_SECRET` is set we mint `username = <expiry>:sabchat` +
 * `credential = base64(HMAC-SHA1(secret, username))`, exactly what coturn's
 * `use-auth-secret` verifies (services/sabchat-turn/) — so creds expire and
 * there are no per-user accounts. Falls back to static `SABCHAT_TURN_USER/CRED`.
 */
export async function getIceServers(): Promise<{ iceServers: RTCIceServer[] }> {
  const url = process.env.SABCHAT_TURN_URL?.trim();
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (url) {
    const secret = process.env.SABCHAT_TURN_SECRET?.trim();
    if (secret) {
      // 12h TTL — comfortably longer than any call.
      const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;
      const username = `${expiry}:sabchat`;
      const credential = createHmac('sha1', secret).update(username).digest('base64');
      servers.push({ urls: url, username, credential });
    } else {
      servers.push({
        urls: url,
        username: process.env.SABCHAT_TURN_USER?.trim() || undefined,
        credential: process.env.SABCHAT_TURN_CRED?.trim() || undefined,
      });
    }
  }
  return { iceServers: servers };
}
