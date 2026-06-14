'use server';

/**
 * SabChat collaboration server actions — project-scoped over the
 * `sabchat-collab` Rust crate (`/v1/sabchat/collab/*`). Private side
 * conversations (internal side-threads) + conversation links.
 */

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type {
  SabChatConversationLink,
  SabChatSideConversation,
  SabChatSideMessage,
} from '@/lib/rust-client/sabchat-collab';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

async function authorName(): Promise<string | undefined> {
  try {
    const session = await getSession();
    const user = session?.user as { name?: string; email?: string } | undefined;
    return user?.name || user?.email || undefined;
  } catch {
    return undefined;
  }
}

type Mut = { ok: true } | { ok: false; error: string };

/* ── side conversations ─────────────────────────────────────────────── */

export async function listSideConversations(
  parentConversationId: string,
): Promise<SabChatSideConversation[]> {
  try {
    const res = await scoped(() => rustClient.sabchatCollab.listSide(parentConversationId));
    return res.sideConversations;
  } catch {
    return [];
  }
}

export async function createSideConversation(
  parentConversationId: string,
  subject: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!subject?.trim()) return { ok: false, error: 'A subject is required.' };
  try {
    const res = await scoped(() =>
      rustClient.sabchatCollab.createSide({ parentConversationId, subject: subject.trim() }),
    );
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function deleteSideConversation(id: string): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatCollab.deleteSide(id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function listSideMessages(id: string): Promise<SabChatSideMessage[]> {
  try {
    const res = await scoped(() => rustClient.sabchatCollab.listSideMessages(id));
    return res.messages;
  } catch {
    return [];
  }
}

export async function appendSideMessage(
  id: string,
  body: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!body?.trim()) return { ok: false, error: 'A message cannot be empty.' };
  try {
    const name = await authorName();
    const res = await scoped(() =>
      rustClient.sabchatCollab.appendSideMessage(id, { body: body.trim(), authorName: name }),
    );
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── conversation links ─────────────────────────────────────────────── */

export async function listConversationLinks(
  conversationId: string,
): Promise<SabChatConversationLink[]> {
  try {
    const res = await scoped(() => rustClient.sabchatCollab.listLinks(conversationId));
    return res.links;
  } catch {
    return [];
  }
}

export async function linkConversations(
  aId: string,
  bId: string,
  note?: string,
): Promise<Mut> {
  if (!aId || !bId) return { ok: false, error: 'Two conversations are required.' };
  if (aId === bId) return { ok: false, error: 'Cannot link a conversation to itself.' };
  try {
    await scoped(() =>
      rustClient.sabchatCollab.createLink({ aId, bId, note: note?.trim() || undefined }),
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function unlinkConversations(linkId: string): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatCollab.deleteLink(linkId));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
