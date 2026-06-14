'use server';

/**
 * SabCall voice broadcast (P5) — the Superphone-style relationship feature:
 * place a call out to a contact segment (everyone, VIPs, or a tag). The engine
 * originates each call; speaking a custom message to the callee uses TTS, which
 * is wired with the live engine on the box — until then the broadcast rings the
 * segment and the routed application greets them.
 */

import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';
import { sabcallEngine, sabcallEngineEnabled } from '@/lib/sabcall/engine-client';
import { listContacts } from '../contacts/actions';

export type BroadcastScope = 'all' | 'vip' | 'tag';

export interface BroadcastInput {
  scope: BroadcastScope;
  tag?: string;
  /** Message to speak (used once TTS is enabled on the engine). */
  message: string;
  callerId?: string;
  /** Safety cap on how many contacts to dial in one run. */
  limit?: number;
}

export interface BroadcastResult {
  success: true;
  queued: number;
  failed: number;
  total: number;
}

export async function startVoiceBroadcast(
  input: BroadcastInput,
): Promise<BroadcastResult | { success: false; error: string }> {
  const ws = await getSabcallWorkspaceId();
  if (!ws) return { success: false, error: 'No SabCall project selected.' };
  if (!input.message.trim()) {
    return { success: false, error: 'Enter a message to broadcast.' };
  }
  if (!sabcallEngineEnabled()) {
    return {
      success: false,
      error:
        'The call engine is not enabled. Set SABCALL_ENABLED=true and connect Asterisk to run broadcasts.',
    };
  }

  const cap = Math.min(Math.max(input.limit ?? 200, 1), 1000);
  const list = await listContacts({
    status: 'active',
    vip: input.scope === 'vip' ? true : undefined,
    limit: cap,
  });

  let contacts = list.items.filter((c) => !!c.phone && !!c.phone.trim());
  if (input.scope === 'tag' && input.tag) {
    const tag = input.tag;
    contacts = contacts.filter((c) => Array.isArray(c.tags) && c.tags.includes(tag));
  }
  const targets = contacts.map((c) => c.phone.trim());

  let queued = 0;
  let failed = 0;
  for (const to of targets) {
    try {
      await sabcallEngine.originate({ tenant: ws, to, callerId: input.callerId });
      queued += 1;
    } catch {
      failed += 1;
    }
  }

  return { success: true, queued, failed, total: targets.length };
}
