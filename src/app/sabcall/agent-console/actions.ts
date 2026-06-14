'use server';

/**
 * SabCall live agent console — lists active calls from the engine and drives
 * the C1 call-control + coaching surface (hold/mute/transfer/hangup/snoop).
 * Engine-gated: returns an empty live list when SABCALL_ENABLED is off.
 */

import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';
import { sabcallEngine, sabcallEngineEnabled } from '@/lib/sabcall/engine-client';
import { getErrorMessage } from '@/lib/utils';

export interface LiveCall {
  id: string;
  state: string;
  from: string;
  to: string;
}

type Ok = { ok: true };
type Err = { ok: false; error: string };

async function guard(fn: () => Promise<unknown>): Promise<Ok | Err> {
  const ws = await getSabcallWorkspaceId();
  if (!ws) return { ok: false, error: 'No SabCall project selected.' };
  if (!sabcallEngineEnabled()) {
    return { ok: false, error: 'The call engine is not enabled.' };
  }
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function listLiveCalls(): Promise<
  { ok: true; calls: LiveCall[]; engineEnabled: boolean } | Err
> {
  const ws = await getSabcallWorkspaceId();
  if (!ws) return { ok: false, error: 'No SabCall project selected.' };
  if (!sabcallEngineEnabled()) return { ok: true, calls: [], engineEnabled: false };
  try {
    const raw = await sabcallEngine.listChannels();
    const calls: LiveCall[] = (Array.isArray(raw) ? raw : [])
      .map((c) => {
        const ch = c as {
          id?: unknown;
          state?: unknown;
          caller?: { number?: unknown };
          connected?: { number?: unknown };
          dialplan?: { exten?: unknown };
        };
        return {
          id: String(ch.id ?? ''),
          state: String(ch.state ?? ''),
          from: String(ch.caller?.number ?? ''),
          to: String(ch.dialplan?.exten ?? ch.connected?.number ?? ''),
        };
      })
      .filter((c) => c.id);
    return { ok: true, calls, engineEnabled: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function holdCall(id: string, held: boolean) {
  return guard(() => sabcallEngine.hold(id, held));
}
export async function muteCall(id: string, muted: boolean) {
  return guard(() => sabcallEngine.mute(id, muted));
}
export async function transferCall(id: string, endpoint: string) {
  return guard(() => sabcallEngine.transfer(id, endpoint));
}
export async function hangupCall(id: string) {
  return guard(() => sabcallEngine.hangup(id));
}
export async function snoopCall(id: string, mode: 'monitor' | 'whisper' | 'barge') {
  return guard(() => sabcallEngine.snoop(id, mode));
}
