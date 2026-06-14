'use server';

/**
 * SabChat co-browse server actions — project-scoped over the
 * `sabchat-cobrowse` Rust crate (`/v1/sabchat/cobrowse/*`). This is the
 * session lifecycle layer (request / end / list); the actual DOM-sync /
 * screen-share is relayed by the media server — see docs/sabchat/OPS.md.
 */

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { SabChatCobrowseSession } from '@/lib/rust-client/sabchat-cobrowse';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

export async function requestCobrowse(
  conversationId: string,
): Promise<{ ok: true; session: SabChatCobrowseSession } | { ok: false; error: string }> {
  if (!conversationId) return { ok: false, error: 'No conversation selected.' };
  try {
    const session = await scoped(() =>
      rustClient.sabchatCobrowse.request(conversationId, { maskPasswordFields: true }),
    );
    return { ok: true, session };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function endCobrowse(
  sessionId: string,
): Promise<{ ok: true; session: SabChatCobrowseSession } | { ok: false; error: string }> {
  try {
    const session = await scoped(() => rustClient.sabchatCobrowse.end(sessionId));
    return { ok: true, session };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
