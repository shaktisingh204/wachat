'use server';

/**
 * SabCall unified inbox — merges the call log (CDRs) and voicemail into one
 * per-peer timeline, and places outbound calls through the voice engine.
 */

import {
  listVoiceCallCdrs,
  listVoicemails,
} from '@/app/actions/sabcall.actions';
import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';
import { sabcallEngine, sabcallEngineEnabled } from '@/lib/sabcall/engine-client';
import { getErrorMessage } from '@/lib/utils';

export interface TimelineItem {
  id: string;
  kind: 'call' | 'voicemail';
  peer: string;
  direction?: 'inbound' | 'outbound';
  status: string;
  at: string | null;
  durationSecs?: number;
  transcript?: string | null;
}

/** Merged, newest-first activity across calls + voicemail for the project. */
export async function listConversations(opts: { q?: string } = {}): Promise<{
  success: true;
  data: TimelineItem[];
}> {
  const [calls, vms] = await Promise.all([
    listVoiceCallCdrs({ q: opts.q }),
    listVoicemails({ q: opts.q }),
  ]);

  const items: TimelineItem[] = [];

  if (calls.success) {
    for (const c of calls.data as Array<Record<string, unknown>>) {
      const direction = (c.direction as 'inbound' | 'outbound') ?? 'inbound';
      const peer =
        direction === 'inbound'
          ? String(c.fromNumber ?? '')
          : String(c.toNumber ?? '');
      items.push({
        id: String(c._id),
        kind: 'call',
        peer,
        direction,
        status: String(c.status ?? 'completed'),
        at: c.startedAt ? new Date(c.startedAt as string).toISOString() : null,
        durationSecs: typeof c.durationSecs === 'number' ? c.durationSecs : 0,
      });
    }
  }

  if (vms.success) {
    for (const v of vms.data as Array<Record<string, unknown>>) {
      items.push({
        id: String(v._id),
        kind: 'voicemail',
        peer: String(v.fromNumber ?? ''),
        direction: 'inbound',
        status: String(v.status ?? 'new'),
        at: v.createdAt ? new Date(v.createdAt as string).toISOString() : null,
        transcript: (v.transcript as string | null) ?? null,
        durationSecs: typeof v.durationSecs === 'number' ? v.durationSecs : 0,
      });
    }
  }

  items.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  return { success: true, data: items };
}

/** Originate an outbound call to `to` via the engine (Asterisk ARI). */
export async function placeCall(
  to: string,
  callerId?: string,
): Promise<{ success: true; channelId: string } | { success: false; error: string }> {
  const ws = await getSabcallWorkspaceId();
  if (!ws) return { success: false, error: 'No SabCall project selected.' };
  if (!to.trim()) return { success: false, error: 'Enter a number to call.' };
  if (!sabcallEngineEnabled()) {
    return {
      success: false,
      error:
        'The call engine is not enabled yet. Set SABCALL_ENABLED=true and connect Asterisk to place live calls.',
    };
  }
  try {
    const res = await sabcallEngine.originate({ tenant: ws, to: to.trim(), callerId });
    return { success: true, channelId: res.channelId };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}
