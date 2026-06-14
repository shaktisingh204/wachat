/**
 * Client for `/v1/sabchat/collab/*` — agent collaboration: private side
 * conversations (internal side-threads on a conversation) and conversation
 * links (relate two conversations). Owned by the `sabchat-collab` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export interface SabChatSideConversation {
  _id: string;
  tenantId: string;
  parentConversationId: string;
  subject: string;
  createdBy: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SabChatSideMessage {
  _id: string;
  tenantId: string;
  sideConversationId: string;
  body: string;
  authorId: string;
  authorName?: string | null;
  createdAt: string;
}

export interface SabChatConversationLink {
  _id: string;
  tenantId: string;
  aId: string;
  bId: string;
  note?: string | null;
  createdBy: string;
  createdAt: string;
}

export const sabchatCollabApi = {
  // ---- side conversations ----
  createSide: (body: { parentConversationId: string; subject: string }) =>
    rustFetch<{ id: string }>('/v1/sabchat/collab/side', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listSide: (parentConversationId: string) =>
    rustFetch<{ sideConversations: SabChatSideConversation[] }>(
      `/v1/sabchat/collab/side${qs({ parentConversationId })}`,
    ),

  deleteSide: (id: string) =>
    rustFetch<{ message: string }>(`/v1/sabchat/collab/side/${id}`, { method: 'DELETE' }),

  listSideMessages: (id: string) =>
    rustFetch<{ messages: SabChatSideMessage[] }>(`/v1/sabchat/collab/side/${id}/messages`),

  appendSideMessage: (id: string, body: { body: string; authorName?: string }) =>
    rustFetch<{ id: string }>(`/v1/sabchat/collab/side/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ---- conversation links ----
  createLink: (body: { aId: string; bId: string; note?: string }) =>
    rustFetch<{ id: string }>('/v1/sabchat/collab/links', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listLinks: (conversationId: string) =>
    rustFetch<{ links: SabChatConversationLink[] }>(
      `/v1/sabchat/collab/links${qs({ conversationId })}`,
    ),

  deleteLink: (id: string) =>
    rustFetch<{ message: string }>(`/v1/sabchat/collab/links/${id}`, { method: 'DELETE' }),
};
