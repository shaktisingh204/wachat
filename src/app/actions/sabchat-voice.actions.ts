'use server';

/**
 * SabChat voice/video call server actions — project-scoped over the
 * `sabchat-voice` Rust crate (`/v1/sabchat/voice/*`). This is the call
 * lifecycle + record layer (start / answer / end / token); the actual WebRTC
 * media is served by a separate media server (SFU/TURN) — see docs/sabchat/OPS.md.
 * The per-call `token` re-issues an access token for that media server.
 */

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
 * ICE/STUN-TURN server config for the browser RTCPeerConnection, read from
 * env (SABCHAT_TURN_URL/USER/CRED). Returns an empty list until a TURN relay
 * is provisioned — the call UI then runs STUN-only (works on the same LAN /
 * with public IPs) and is documented as needing coturn for NAT traversal.
 */
export async function getIceServers(): Promise<{ iceServers: RTCIceServer[] }> {
  const url = process.env.SABCHAT_TURN_URL?.trim();
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (url) {
    servers.push({
      urls: url,
      username: process.env.SABCHAT_TURN_USER?.trim() || undefined,
      credential: process.env.SABCHAT_TURN_CRED?.trim() || undefined,
    });
  }
  return { iceServers: servers };
}
