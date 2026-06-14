'use server';

/**
 * SabChat inbox server actions — project-scoped shim over the Rust BFF
 * (`/v1/sabchat/*`).
 *
 * Every call runs inside `runWithRustTenant(workspaceId, …)` so the Rust
 * JWT's `tid` claim is the active SabChat **project** id (not the user id).
 * The sabchat-* crates filter every collection by `tenantId == tid`, so this
 * is what isolates one chat project's data from another. `getSabchatWorkspaceId`
 * reads the `sabchat_project` cookie set by the project picker.
 *
 * This is the data layer for the new top-level `/sabchat` inbox. The legacy
 * `sabchat-v2.actions.ts` (user-scoped, `/dashboard/sabchat/inbox-v2`) is left
 * untouched and gets deleted in P7.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type {
  ContentBlock,
  ConversationPriority,
  ConversationStatus,
  SabChatContact,
  SabChatConversation,
  SabChatInbox,
  SabChatMessage,
} from '@/lib/rust-client/sabchat';

const INBOX_PATH = '/sabchat/inbox';

/** Resolve the active workspace and run `fn` scoped to it. */
async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

type Mut = { ok: true } | { ok: false; error: string };

async function mutate(run: () => Promise<unknown>): Promise<Mut> {
  try {
    await scoped(run);
    revalidatePath(INBOX_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listInboxes(): Promise<{ items: SabChatInbox[]; error?: string }> {
  try {
    return await scoped(() => rustClient.sabchat.inboxes.list());
  } catch (e) {
    return { items: [], error: getErrorMessage(e) };
  }
}

export async function listConversations(params: {
  inboxId?: string;
  status?: ConversationStatus;
  assigneeId?: string;
  label?: string;
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: SabChatConversation[]; nextCursor?: string; error?: string }> {
  try {
    return await scoped(() => rustClient.sabchat.conversations.list(params));
  } catch (e) {
    return { items: [], error: getErrorMessage(e) };
  }
}

export async function getConversation(id: string): Promise<SabChatConversation | null> {
  try {
    return await scoped(() => rustClient.sabchat.conversations.get(id));
  } catch {
    return null;
  }
}

export async function listMessages(
  conversationId: string,
  beforeId?: string,
): Promise<{ items: SabChatMessage[]; error?: string }> {
  try {
    return await scoped(() =>
      rustClient.sabchat.messages.list({ conversationId, beforeId, limit: 100 }),
    );
  } catch (e) {
    return { items: [], error: getErrorMessage(e) };
  }
}

export async function getContact(id: string): Promise<SabChatContact | null> {
  try {
    return await scoped(() => rustClient.sabchat.contacts.get(id));
  } catch {
    return null;
  }
}

export async function agentLoad(): Promise<
  Array<{ agentId: string; openCount: number; urgentCount: number; oldestMinutes: number }>
> {
  try {
    return await scoped(() => rustClient.sabchat.routing.agentLoad());
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function sendAgentMessage(
  conversationId: string,
  content: ContentBlock,
  opts: { private?: boolean } = {},
): Promise<{ ok: true; data: SabChatMessage } | { ok: false; error: string }> {
  try {
    const data = await scoped(() =>
      rustClient.sabchat.messages.append({
        conversationId,
        content,
        private: opts.private ?? false,
        senderType: 'agent',
      }),
    );
    revalidatePath(INBOX_PATH);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Convenience for the common plain-text send. */
export async function sendAgentText(
  conversationId: string,
  text: string,
  opts: { private?: boolean } = {},
) {
  if (!text.trim()) return { ok: false as const, error: 'Empty message' };
  return sendAgentMessage(conversationId, { kind: 'text', text }, opts);
}

export const setConversationStatus = (id: string, status: ConversationStatus) =>
  mutate(() => rustClient.sabchat.conversations.setStatus(id, status));

export const setConversationPriority = (id: string, priority: ConversationPriority) =>
  mutate(() => rustClient.sabchat.conversations.setPriority(id, priority));

export const setConversationAssignee = (
  id: string,
  assigneeId: string | null,
  reason?: string,
) => mutate(() => rustClient.sabchat.conversations.setAssignee(id, assigneeId, reason));

export const addConversationLabel = (id: string, label: string) =>
  mutate(() => rustClient.sabchat.conversations.addLabel(id, label));

export const removeConversationLabel = (id: string, label: string) =>
  mutate(() => rustClient.sabchat.conversations.removeLabel(id, label));

export const snoozeConversation = (id: string, until: string) =>
  mutate(() => rustClient.sabchat.conversations.snooze(id, until));

export const resolveConversation = (id: string) =>
  mutate(() => rustClient.sabchat.conversations.resolve(id));

export const reopenConversation = (id: string) =>
  mutate(() => rustClient.sabchat.conversations.reopen(id));

export const autoAssignConversation = (
  id: string,
  strategy: 'round_robin' | 'manual' | 'sticky' | 'unassign' = 'round_robin',
  agentId?: string,
) => mutate(() => rustClient.sabchat.routing.assign(id, { strategy, agentId }));
