/**
 * Forge block: Twist
 *
 * Source: n8n-master/packages/nodes-base/nodes/Twist/Twist.node.ts
 *
 * Auth: Bearer accessToken on `https://api.twist.com/api/v3`.
 *
 * Operations covered:
 *   - thread.add      POST /threads/add
 *   - channel.list    GET  /channels/get
 *   - comment.add     POST /comments/add
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.twist.com/api/v3';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Twist: accessToken is required');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function threadAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  const title = asString(ctx.options.title);
  const content = asString(ctx.options.content);
  if (!channelId || !title || !content) {
    throw new Error('Twist: channelId, title and content are required');
  }
  const body = {
    channel_id: Number(channelId),
    title,
    content,
  };
  const res = await apiRequest({
    service: 'Twist',
    method: 'POST',
    url: `${API}/threads/add`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { thread: res.data }, logs: [`Twist thread add → ${title}`] };
}

async function channelList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workspaceId = asString(ctx.options.workspaceId);
  if (!workspaceId) throw new Error('Twist: workspaceId is required');
  const params = new URLSearchParams({ workspace_id: workspaceId });
  const res = await apiRequest({
    service: 'Twist',
    method: 'GET',
    url: `${API}/channels/get?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { channels: res.data }, logs: [`Twist channel list → ${workspaceId}`] };
}

async function commentAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const threadId = asString(ctx.options.threadId);
  const content = asString(ctx.options.content);
  if (!threadId || !content) throw new Error('Twist: threadId and content are required');
  const body = {
    thread_id: Number(threadId),
    content,
  };
  const res = await apiRequest({
    service: 'Twist',
    method: 'POST',
    url: `${API}/comments/add`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { comment: res.data }, logs: [`Twist comment add → ${threadId}`] };
}

const block: ForgeBlock = {
  id: 'forge_twist',
  name: 'Twist',
  description: 'Post threads, list channels and add comments in Twist.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'thread_add',
      label: 'Add thread',
      description: 'Start a new thread in a channel.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'text', required: true },
      ],
      run: threadAdd,
    },
    {
      id: 'channel_list',
      label: 'List channels',
      description: 'List channels in a workspace.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'workspaceId', label: 'Workspace ID', type: 'text', required: true },
      ],
      run: channelList,
    },
    {
      id: 'comment_add',
      label: 'Add comment',
      description: 'Add a comment to a thread.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'threadId', label: 'Thread ID', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'text', required: true },
      ],
      run: commentAdd,
    },
  ],
};

registerForgeBlock(block);
export default block;
