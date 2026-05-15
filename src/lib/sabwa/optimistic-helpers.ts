/**
 * SabWa — optimistic UI helpers.
 *
 * Pure, side-effect-free reducers that the chat / inbox views use to keep
 * the UI responsive while a server action is in flight. Each helper takes
 * the current immutable slice + an input and returns the next slice (no
 * mutation). Pair them with `useState` setters or SWR `mutate`.
 *
 * All helpers no-op when the target row is not found.
 */

import type { SabwaChat, SabwaMessage, SabwaMessageStatus } from './types';

/**
 * Optimistic draft used by `optimisticSend`. Fields mirror the canonical
 * `SabwaMessage` columns the inbox renders; we keep this loose so the call
 * site doesn't have to fake every Mongo-only field.
 */
export interface OptimisticDraft {
  /** Pre-server temp id (e.g. `temp:${nanoid()}`). Required so the reply
   *  can later be matched with `markMessageStatus` / replaced when the
   *  engine responds. */
  messageId: string;
  chatJid: string;
  fromJid: string;
  body?: string;
  caption?: string;
  type?: SabwaMessage['type'];
  mediaUrl?: string;
  mediaMime?: string;
  mediaSize?: number;
  quotedMessageId?: string;
  ts?: Date;
}

/**
 * Append an optimistic outgoing message to a chat's message list. The
 * resulting row carries `status: 'sending'` and `fromMe: true`. If a
 * message with the same `messageId` already exists, the list is returned
 * unchanged (idempotent — useful when SSE fans out before the local send
 * resolves).
 */
export function optimisticSend(
  chatMessages: SabwaMessage[],
  draft: OptimisticDraft,
): SabwaMessage[] {
  if (chatMessages.some((m) => m.messageId === draft.messageId)) {
    return chatMessages;
  }
  const pending: SabwaMessage = {
    // ObjectId placeholders — these are never sent back to Mongo from the
    // client. Anyone who needs a real `_id` should swap this row after the
    // server replies via `replaceLocal` (see `use-sabwa-data.ts`).
    _id: draft.messageId as unknown as SabwaMessage['_id'],
    projectId: '' as unknown as SabwaMessage['projectId'],
    sessionId: '' as unknown as SabwaMessage['sessionId'],
    chatJid: draft.chatJid,
    messageId: draft.messageId,
    fromJid: draft.fromJid,
    fromMe: true,
    type: draft.type ?? 'text',
    body: draft.body,
    caption: draft.caption,
    mediaUrl: draft.mediaUrl,
    mediaMime: draft.mediaMime,
    mediaSize: draft.mediaSize,
    quotedMessageId: draft.quotedMessageId,
    reactions: [],
    status: 'sending',
    ts: draft.ts ?? new Date(),
  };
  return [...chatMessages, pending];
}

/**
 * Update a single message's `status` (e.g. pending → sent → delivered → read).
 * Returns the input list unchanged if the message isn't present.
 */
export function markMessageStatus(
  chatMessages: SabwaMessage[],
  messageId: string,
  status: SabwaMessageStatus,
): SabwaMessage[] {
  let changed = false;
  const next = chatMessages.map((m) => {
    if (m.messageId !== messageId || m.status === status) return m;
    changed = true;
    return { ...m, status };
  });
  return changed ? next : chatMessages;
}

/**
 * Toggle the `pinned` flag on a chat row in-place (without mutation).
 * Returns the input list unchanged if the chat isn't present.
 */
export function togglePin(chats: SabwaChat[], chatJid: string): SabwaChat[] {
  let changed = false;
  const next = chats.map((c) => {
    if (c.jid !== chatJid) return c;
    changed = true;
    return { ...c, pinned: !c.pinned };
  });
  return changed ? next : chats;
}

/**
 * Mark a chat as archived (or unarchive it) and remove it from the active
 * list when archived. We keep the chat in-place but flip `archived` so the
 * caller's filter (`archivedOnly`) decides visibility — that way the next
 * `refetch()` doesn't surprise the user.
 */
export function archiveChat(chats: SabwaChat[], chatJid: string): SabwaChat[] {
  let changed = false;
  const next = chats.map((c) => {
    if (c.jid !== chatJid) return c;
    changed = true;
    return { ...c, archived: !c.archived };
  });
  return changed ? next : chats;
}
