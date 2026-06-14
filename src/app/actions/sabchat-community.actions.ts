'use server';

/**
 * SabChat community-forum server actions — project-scoped over the
 * `sabchat-community` Rust crate (`/v1/sabchat/community/*`). Topics + replies
 * with upvotes, accepted answers, and pin/status/delete moderation. The
 * author's display name is resolved from the session so the UI shows real
 * names without a join.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type {
  SabChatCommunityPost,
  SabChatCommunityTopic,
  SabChatCommunityTopicStatus,
  SabChatCommunityUpvote,
} from '@/lib/rust-client/sabchat-community';

const COMMUNITY_PATH = '/sabchat/community';

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

export async function listTopics(
  q: { category?: string; status?: SabChatCommunityTopicStatus; sort?: 'recent' | 'top' } = {},
): Promise<SabChatCommunityTopic[]> {
  try {
    const res = await scoped(() => rustClient.sabchatCommunity.listTopics({ ...q, limit: 100 }));
    return res.topics;
  } catch {
    return [];
  }
}

export async function getTopic(
  id: string,
): Promise<{ topic: SabChatCommunityTopic; posts: SabChatCommunityPost[] } | null> {
  try {
    return await scoped(() => rustClient.sabchatCommunity.getTopic(id));
  } catch {
    return null;
  }
}

export async function createTopic(input: {
  title: string;
  body: string;
  category?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title) return { ok: false, error: 'A title is required.' };
  if (!body) return { ok: false, error: 'A question body is required.' };
  try {
    const name = await authorName();
    const res = await scoped(() =>
      rustClient.sabchatCommunity.createTopic({
        title,
        body,
        category: input.category?.trim() || undefined,
        authorName: name,
      }),
    );
    revalidatePath(COMMUNITY_PATH);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function updateTopic(
  id: string,
  patch: {
    title?: string;
    body?: string;
    category?: string;
    status?: SabChatCommunityTopicStatus;
    pinned?: boolean;
  },
): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatCommunity.updateTopic(id, patch));
    revalidatePath(COMMUNITY_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function deleteTopic(id: string): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatCommunity.deleteTopic(id));
    revalidatePath(COMMUNITY_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function upvoteTopic(
  id: string,
): Promise<{ ok: true; result: SabChatCommunityUpvote } | { ok: false; error: string }> {
  try {
    const result = await scoped(() => rustClient.sabchatCommunity.upvoteTopic(id));
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function createPost(
  topicId: string,
  body: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const text = body?.trim();
  if (!text) return { ok: false, error: 'A reply cannot be empty.' };
  try {
    const name = await authorName();
    const res = await scoped(() =>
      rustClient.sabchatCommunity.createPost(topicId, { body: text, authorName: name }),
    );
    revalidatePath(`${COMMUNITY_PATH}/${topicId}`);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function upvotePost(
  id: string,
): Promise<{ ok: true; result: SabChatCommunityUpvote } | { ok: false; error: string }> {
  try {
    const result = await scoped(() => rustClient.sabchatCommunity.upvotePost(id));
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function markAnswer(postId: string, topicId: string): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatCommunity.markAnswer(postId));
    revalidatePath(`${COMMUNITY_PATH}/${topicId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function deletePost(postId: string, topicId: string): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatCommunity.deletePost(postId));
    revalidatePath(`${COMMUNITY_PATH}/${topicId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
