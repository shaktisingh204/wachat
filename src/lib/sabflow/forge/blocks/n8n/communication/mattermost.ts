/**
 * Forge block: Mattermost
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mattermost/Mattermost.node.ts (and v1/actions/)
 * Credential type: 'mattermost' — { baseUrl, accessToken } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - message.post        POST /posts
 *   - message.postEphemeral POST /posts/ephemeral
 *   - message.delete      DELETE /posts/{postId}
 *   - channel.create      POST /channels
 *   - reaction.create     POST /reactions
 *
 * Out of scope for the first port:
 *   - Attachments/actions builder UI — pass attachments JSON as a string
 *   - channel.addUser/restore/search/members/statistics, user resource
 *   - Pagination helpers (single-page calls only)
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type MattermostCred = { baseUrl: string; accessToken: string };

function credsOrThrow(ctx: ForgeActionContext): MattermostCred {
  const cred = requireCredential('Mattermost', ctx.credential);
  const baseUrl = (cred.baseUrl ?? '').replace(/\/$/, '');
  const accessToken = cred.accessToken ?? '';
  if (!baseUrl) throw new Error('Mattermost: credential missing `baseUrl`');
  if (!accessToken) throw new Error('Mattermost: credential missing `accessToken`');
  return { baseUrl, accessToken };
}

async function mm(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: unknown,
): Promise<unknown> {
  const { baseUrl, accessToken } = credsOrThrow(ctx);
  const res = await apiRequest({
    service: 'Mattermost',
    method,
    url: `${baseUrl}/api/v4/${endpoint.replace(/^\//, '')}`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return res.data;
}

function parseJson<T>(raw: unknown, field: string, fallback: T): T {
  const s = asString(raw).trim();
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch (err) {
    throw new Error(`Mattermost: ${field} is not valid JSON — ${(err as Error).message}`);
  }
}

async function postMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  const message = asString(ctx.options.message);
  if (!channelId) throw new Error('Mattermost: channelId is required');
  if (!message) throw new Error('Mattermost: message is required');

  const body: Record<string, unknown> = { channel_id: channelId, message };
  const attachments = parseJson<unknown[]>(ctx.options.attachments, 'attachments', []);
  if (attachments.length) body.props = { attachments };
  const rootId = asString(ctx.options.rootId);
  if (rootId) body.root_id = rootId;

  const result = await mm(ctx, 'POST', 'posts', body);
  return { outputs: { post: result }, logs: [`Mattermost post → ${channelId}`] };
}

async function postEphemeral(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  const userId = asString(ctx.options.userId);
  const message = asString(ctx.options.message);
  if (!channelId) throw new Error('Mattermost: channelId is required');
  if (!userId) throw new Error('Mattermost: userId is required');
  if (!message) throw new Error('Mattermost: message is required');

  const result = await mm(ctx, 'POST', 'posts/ephemeral', {
    user_id: userId,
    post: { channel_id: channelId, message },
  });
  return { outputs: { post: result }, logs: [`Mattermost ephemeral → ${userId} in ${channelId}`] };
}

async function deletePost(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const postId = asString(ctx.options.postId);
  if (!postId) throw new Error('Mattermost: postId is required');
  const result = await mm(ctx, 'DELETE', `posts/${encodeURIComponent(postId)}`);
  return { outputs: { result }, logs: [`Mattermost delete post → ${postId}`] };
}

async function channelCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const teamId = asString(ctx.options.teamId);
  const name = asString(ctx.options.name);
  const displayName = asString(ctx.options.displayName);
  const channelType = asString(ctx.options.type) || 'public';
  if (!teamId) throw new Error('Mattermost: teamId is required');
  if (!name) throw new Error('Mattermost: channel name is required');
  if (!displayName) throw new Error('Mattermost: displayName is required');

  const result = await mm(ctx, 'POST', 'channels', {
    team_id: teamId,
    name,
    display_name: displayName,
    type: channelType === 'public' ? 'O' : 'P',
  });
  return { outputs: { channel: result }, logs: [`Mattermost channel create → ${name}`] };
}

async function reactionCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId);
  const postId = asString(ctx.options.postId);
  const emojiName = asString(ctx.options.emojiName);
  if (!userId) throw new Error('Mattermost: userId is required');
  if (!postId) throw new Error('Mattermost: postId is required');
  if (!emojiName) throw new Error('Mattermost: emojiName is required');

  const result = await mm(ctx, 'POST', 'reactions', {
    user_id: userId,
    post_id: postId,
    emoji_name: emojiName,
    create_at: 0,
  });
  return { outputs: { reaction: result }, logs: [`Mattermost reaction → ${emojiName} on ${postId}`] };
}

const block: ForgeBlock = {
  id: 'forge_mattermost',
  name: 'Mattermost',
  description: 'Post messages, manage channels and reactions in Mattermost.',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mattermost' },
  actions: [
    {
      id: 'message_post',
      label: 'Post message',
      description: 'Post a message into a channel.',
      fields: [
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'rootId', label: 'Reply to root post ID', type: 'text' },
        { id: 'attachments', label: 'Attachments (JSON array)', type: 'json' },
      ],
      run: postMessage,
    },
    {
      id: 'message_post_ephemeral',
      label: 'Post ephemeral message',
      description: 'Post a message only visible to a single user.',
      fields: [
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
      ],
      run: postEphemeral,
    },
    {
      id: 'message_delete',
      label: 'Delete post',
      description: 'Soft-delete a post.',
      fields: [{ id: 'postId', label: 'Post ID', type: 'text', required: true }],
      run: deletePost,
    },
    {
      id: 'channel_create',
      label: 'Create channel',
      description: 'Create a public or private channel in a team.',
      fields: [
        { id: 'teamId', label: 'Team ID', type: 'text', required: true },
        { id: 'name', label: 'Internal name', type: 'text', required: true, placeholder: 'my-channel' },
        { id: 'displayName', label: 'Display name', type: 'text', required: true },
        {
          id: 'type',
          label: 'Type',
          type: 'select',
          defaultValue: 'public',
          options: [
            { label: 'Public', value: 'public' },
            { label: 'Private', value: 'private' },
          ],
        },
      ],
      run: channelCreate,
    },
    {
      id: 'reaction_create',
      label: 'Add reaction',
      description: 'Add an emoji reaction to a post.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'postId', label: 'Post ID', type: 'text', required: true },
        { id: 'emojiName', label: 'Emoji name', type: 'text', required: true, placeholder: 'thumbsup' },
      ],
      run: reactionCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
