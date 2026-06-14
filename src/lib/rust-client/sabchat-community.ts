/**
 * Client for `/v1/sabchat/community/*` — the SabChat community forum:
 * tenant-scoped topics + replies with upvotes, accepted answers, and
 * pin/status/delete moderation. Owned by the `sabchat-community` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatCommunityTopicStatus = 'open' | 'answered' | 'closed';

export interface SabChatCommunityTopic {
  _id: string;
  tenantId: string;
  title: string;
  body: string;
  category?: string | null;
  authorId: string;
  authorName?: string | null;
  status: SabChatCommunityTopicStatus;
  pinned: boolean;
  upvotes: number;
  replyCount: number;
  answerPostId?: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SabChatCommunityPost {
  _id: string;
  tenantId: string;
  topicId: string;
  body: string;
  authorId: string;
  authorName?: string | null;
  isAnswer: boolean;
  upvotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface SabChatCommunityUpvote {
  id: string;
  upvotes: number;
  voted: boolean;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const sabchatCommunityApi = {
  createTopic: (body: {
    title: string;
    body: string;
    category?: string;
    authorName?: string;
  }) =>
    rustFetch<{ id: string }>('/v1/sabchat/community/topics', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listTopics: (
    q: { category?: string; status?: SabChatCommunityTopicStatus; sort?: 'recent' | 'top'; limit?: number } = {},
  ) =>
    rustFetch<{ topics: SabChatCommunityTopic[] }>(`/v1/sabchat/community/topics${qs(q)}`),

  getTopic: (id: string) =>
    rustFetch<{ topic: SabChatCommunityTopic; posts: SabChatCommunityPost[] }>(
      `/v1/sabchat/community/topics/${id}`,
    ),

  updateTopic: (
    id: string,
    body: {
      title?: string;
      body?: string;
      category?: string;
      status?: SabChatCommunityTopicStatus;
      pinned?: boolean;
    },
  ) =>
    rustFetch<{ message: string }>(`/v1/sabchat/community/topics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteTopic: (id: string) =>
    rustFetch<{ message: string }>(`/v1/sabchat/community/topics/${id}`, { method: 'DELETE' }),

  upvoteTopic: (id: string) =>
    rustFetch<SabChatCommunityUpvote>(`/v1/sabchat/community/topics/${id}/upvote`, {
      method: 'POST',
    }),

  createPost: (topicId: string, body: { body: string; authorName?: string }) =>
    rustFetch<{ id: string }>(`/v1/sabchat/community/topics/${topicId}/posts`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  upvotePost: (id: string) =>
    rustFetch<SabChatCommunityUpvote>(`/v1/sabchat/community/posts/${id}/upvote`, {
      method: 'POST',
    }),

  markAnswer: (id: string) =>
    rustFetch<{ message: string }>(`/v1/sabchat/community/posts/${id}/answer`, { method: 'POST' }),

  deletePost: (id: string) =>
    rustFetch<{ message: string }>(`/v1/sabchat/community/posts/${id}`, { method: 'DELETE' }),
};
