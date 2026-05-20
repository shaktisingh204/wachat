/**
 * Forge block: Mattermost
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mattermost/Mattermost.node.ts (and v1/actions/)
 * Credential type: 'mattermost' — { baseUrl, accessToken } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - channel.addUser     POST   /channels/{channelId}/members
 *   - channel.create      POST   /channels
 *   - channel.delete      DELETE /channels/{channelId}
 *   - channel.members     GET    /channels/{channelId}/members
 *   - channel.restore     POST   /channels/{channelId}/restore
 *   - channel.search      POST   /teams/{teamId}/channels/search
 *   - channel.statistics  GET    /channels/{channelId}/stats
 *   - message.post        POST   /posts
 *   - message.postEphemeral POST /posts/ephemeral
 *   - message.delete      DELETE /posts/{postId}
 *   - reaction.create     POST   /reactions
 *   - reaction.delete     DELETE /users/{userId}/posts/{postId}/reactions/{emojiName}
 *   - reaction.getAll     GET    /posts/{postId}/reactions
 *   - user.create         POST   /users
 *   - user.deactivate     DELETE /users/{userId}
 *   - user.getAll         GET    /users
 *   - user.getByEmail     GET    /users/email/{email}
 *   - user.getById        POST   /users/ids
 *   - user.invite         POST   /teams/{teamId}/invite/email
 *
 * Out of scope:
 *   - Attachments/actions builder UI — pass attachments JSON as a string.
 *   - `user.create` `notify_props` builder UI — pass via additional JSON.
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

async function reactionDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId);
  const postId = asString(ctx.options.postId);
  // Upstream strips surrounding colons, e.g. `:thumbsup:` → `thumbsup`.
  const emojiName = asString(ctx.options.emojiName).replace(/:/g, '');
  if (!userId) throw new Error('Mattermost: userId is required');
  if (!postId) throw new Error('Mattermost: postId is required');
  if (!emojiName) throw new Error('Mattermost: emojiName is required');
  const result = await mm(
    ctx,
    'DELETE',
    `users/${encodeURIComponent(userId)}/posts/${encodeURIComponent(postId)}/reactions/${encodeURIComponent(emojiName)}`,
  );
  return { outputs: { result }, logs: [`Mattermost reaction delete → ${emojiName}`] };
}

async function reactionGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const postId = asString(ctx.options.postId);
  if (!postId) throw new Error('Mattermost: postId is required');
  const limit = Number(asString(ctx.options.limit) || '0');
  const result = (await mm(ctx, 'GET', `posts/${encodeURIComponent(postId)}/reactions`)) as
    | unknown[]
    | null;
  const list = Array.isArray(result) ? result : [];
  const sliced = limit > 0 ? list.slice(0, limit) : list;
  return { outputs: { reactions: sliced }, logs: [`Mattermost reactions → ${sliced.length}`] };
}

async function channelDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  if (!channelId) throw new Error('Mattermost: channelId is required');
  const result = await mm(ctx, 'DELETE', `channels/${encodeURIComponent(channelId)}`);
  return { outputs: { result }, logs: [`Mattermost channel delete → ${channelId}`] };
}

async function channelRestore(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  if (!channelId) throw new Error('Mattermost: channelId is required');
  const result = await mm(ctx, 'POST', `channels/${encodeURIComponent(channelId)}/restore`);
  return { outputs: { channel: result }, logs: [`Mattermost channel restore → ${channelId}`] };
}

async function channelStatistics(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  if (!channelId) throw new Error('Mattermost: channelId is required');
  const result = await mm(ctx, 'GET', `channels/${encodeURIComponent(channelId)}/stats`);
  return { outputs: { stats: result }, logs: [`Mattermost channel stats → ${channelId}`] };
}

async function channelAddUser(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  const userId = asString(ctx.options.userId);
  if (!channelId) throw new Error('Mattermost: channelId is required');
  if (!userId) throw new Error('Mattermost: userId is required');
  const result = await mm(ctx, 'POST', `channels/${encodeURIComponent(channelId)}/members`, {
    user_id: userId,
  });
  return {
    outputs: { member: result },
    logs: [`Mattermost channel addUser → ${userId} to ${channelId}`],
  };
}

async function channelMembers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  if (!channelId) throw new Error('Mattermost: channelId is required');
  const perPage = asString(ctx.options.perPage) || '60';
  const result = (await mm(
    ctx,
    'GET',
    `channels/${encodeURIComponent(channelId)}/members?per_page=${encodeURIComponent(perPage)}`,
  )) as unknown[] | null;
  const members = Array.isArray(result) ? result : [];
  return { outputs: { members }, logs: [`Mattermost channel members → ${members.length}`] };
}

async function channelSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const teamId = asString(ctx.options.teamId);
  const term = asString(ctx.options.term);
  if (!teamId) throw new Error('Mattermost: teamId is required');
  if (!term) throw new Error('Mattermost: term is required');
  const limit = Number(asString(ctx.options.limit) || '0');
  const result = (await mm(ctx, 'POST', `teams/${encodeURIComponent(teamId)}/channels/search`, {
    term,
  })) as unknown[] | null;
  const list = Array.isArray(result) ? result : [];
  const sliced = limit > 0 ? list.slice(0, limit) : list;
  return { outputs: { channels: sliced }, logs: [`Mattermost channel search → ${sliced.length}`] };
}

async function userCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const username = asString(ctx.options.username);
  const authService = asString(ctx.options.authService) || 'email';
  if (!username) throw new Error('Mattermost: username is required');
  const body: Record<string, unknown> = {
    username,
    auth_service: authService,
    ...parseJson<Record<string, unknown>>(ctx.options.additionalFields, 'additionalFields', {}),
  };
  if (authService === 'email') {
    const email = asString(ctx.options.email);
    const password = asString(ctx.options.password);
    if (!email) throw new Error('Mattermost: email is required when authService is email');
    if (!password) throw new Error('Mattermost: password is required when authService is email');
    body.email = email;
    body.password = password;
  } else {
    const authData = asString(ctx.options.authData);
    if (!authData) throw new Error('Mattermost: authData is required for non-email authService');
    body.auth_data = authData;
  }
  const result = await mm(ctx, 'POST', 'users', body);
  return { outputs: { user: result }, logs: [`Mattermost user create → ${username}`] };
}

async function userDeactivate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId);
  if (!userId) throw new Error('Mattermost: userId is required');
  const result = await mm(ctx, 'DELETE', `users/${encodeURIComponent(userId)}`);
  return { outputs: { result }, logs: [`Mattermost user deactivate → ${userId}`] };
}

async function userGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const qs = new URLSearchParams();
  const perPage = asString(ctx.options.perPage);
  if (perPage) qs.set('per_page', perPage);
  const inTeam = asString(ctx.options.inTeam);
  const notInTeam = asString(ctx.options.notInTeam);
  const inChannel = asString(ctx.options.inChannel);
  const notInChannel = asString(ctx.options.notInChannel);
  const sort = asString(ctx.options.sort);
  if (inTeam) qs.set('in_team', inTeam);
  if (notInTeam) qs.set('not_in_team', notInTeam);
  if (inChannel) qs.set('in_channel', inChannel);
  if (notInChannel) qs.set('not_in_channel', notInChannel);
  if (sort) qs.set('sort', sort);
  const result = (await mm(ctx, 'GET', `users?${qs.toString()}`)) as unknown[] | null;
  const users = Array.isArray(result) ? result : [];
  return { outputs: { users }, logs: [`Mattermost users → ${users.length}`] };
}

async function userGetByEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Mattermost: email is required');
  const result = await mm(ctx, 'GET', `users/email/${encodeURIComponent(email)}`);
  return { outputs: { user: result }, logs: [`Mattermost user by email → ${email}`] };
}

async function userGetById(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const raw = asString(ctx.options.userIds);
  if (!raw) throw new Error('Mattermost: userIds is required (comma-separated)');
  const userIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (userIds.length === 0) throw new Error('Mattermost: provide at least one user ID');
  // n8n posts the array as the raw body (no wrapping object); endpoint accepts it directly.
  const since = asString(ctx.options.since);
  const path = since ? `users/ids?since=${encodeURIComponent(String(new Date(since).getTime()))}` : 'users/ids';
  const result = (await mm(ctx, 'POST', path, userIds)) as unknown[] | null;
  return { outputs: { users: result ?? [] }, logs: [`Mattermost users by id → ${userIds.length}`] };
}

async function userInvite(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const teamId = asString(ctx.options.teamId);
  const raw = asString(ctx.options.emails);
  if (!teamId) throw new Error('Mattermost: teamId is required');
  if (!raw) throw new Error('Mattermost: emails is required (comma-separated)');
  const emails = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (emails.length === 0) throw new Error('Mattermost: provide at least one email');
  const result = await mm(ctx, 'POST', `teams/${encodeURIComponent(teamId)}/invite/email`, emails);
  return { outputs: { result }, logs: [`Mattermost user invite → ${emails.length} to ${teamId}`] };
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
    {
      id: 'reaction_delete',
      label: 'Remove reaction',
      description: 'Remove an emoji reaction from a post.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'postId', label: 'Post ID', type: 'text', required: true },
        { id: 'emojiName', label: 'Emoji name', type: 'text', required: true },
      ],
      run: reactionDelete,
    },
    {
      id: 'reaction_get_all',
      label: 'List reactions',
      description: 'List reactions on a post.',
      fields: [
        { id: 'postId', label: 'Post ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (0 = no cap)', type: 'number', defaultValue: '0' },
      ],
      run: reactionGetAll,
    },
    {
      id: 'channel_delete',
      label: 'Delete channel',
      description: 'Soft-delete (archive) a channel.',
      fields: [{ id: 'channelId', label: 'Channel ID', type: 'text', required: true }],
      run: channelDelete,
    },
    {
      id: 'channel_restore',
      label: 'Restore channel',
      description: 'Restore an archived channel.',
      fields: [{ id: 'channelId', label: 'Channel ID', type: 'text', required: true }],
      run: channelRestore,
    },
    {
      id: 'channel_statistics',
      label: 'Channel statistics',
      description: 'Get member-count stats for a channel.',
      fields: [{ id: 'channelId', label: 'Channel ID', type: 'text', required: true }],
      run: channelStatistics,
    },
    {
      id: 'channel_add_user',
      label: 'Add user to channel',
      description: 'Add a user to a channel.',
      fields: [
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: channelAddUser,
    },
    {
      id: 'channel_members',
      label: 'List channel members',
      description: 'List members of a channel.',
      fields: [
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'perPage', label: 'Per page (max 200)', type: 'number', defaultValue: '60' },
      ],
      run: channelMembers,
    },
    {
      id: 'channel_search',
      label: 'Search channels',
      description: 'Search channels in a team by term.',
      fields: [
        { id: 'teamId', label: 'Team ID', type: 'text', required: true },
        { id: 'term', label: 'Search term', type: 'text', required: true },
        { id: 'limit', label: 'Limit (0 = no cap)', type: 'number', defaultValue: '0' },
      ],
      run: channelSearch,
    },
    {
      id: 'user_create',
      label: 'Create user',
      description: 'Create a Mattermost user.',
      fields: [
        { id: 'username', label: 'Username', type: 'text', required: true },
        {
          id: 'authService',
          label: 'Auth service',
          type: 'select',
          defaultValue: 'email',
          options: [
            { label: 'Email', value: 'email' },
            { label: 'GitLab', value: 'gitlab' },
            { label: 'LDAP', value: 'ldap' },
            { label: 'SAML', value: 'saml' },
            { label: 'Google', value: 'google' },
            { label: 'Office 365', value: 'office365' },
          ],
        },
        { id: 'email', label: 'Email (email auth only)', type: 'text' },
        { id: 'password', label: 'Password (email auth only)', type: 'password' },
        { id: 'authData', label: 'Auth data (non-email auth only)', type: 'text' },
        { id: 'additionalFields', label: 'Additional fields (JSON)', type: 'json' },
      ],
      run: userCreate,
    },
    {
      id: 'user_deactivate',
      label: 'Deactivate user',
      description: 'Deactivate (soft-delete) a user.',
      fields: [{ id: 'userId', label: 'User ID', type: 'text', required: true }],
      run: userDeactivate,
    },
    {
      id: 'user_get_all',
      label: 'List users',
      description: 'List users with optional team/channel filters.',
      fields: [
        { id: 'perPage', label: 'Per page (max 200)', type: 'number', defaultValue: '60' },
        { id: 'inTeam', label: 'In team (ID)', type: 'text' },
        { id: 'notInTeam', label: 'Not in team (ID)', type: 'text' },
        { id: 'inChannel', label: 'In channel (ID)', type: 'text' },
        { id: 'notInChannel', label: 'Not in channel (ID)', type: 'text' },
        {
          id: 'sort',
          label: 'Sort',
          type: 'select',
          options: [
            { label: 'Default', value: '' },
            { label: 'Username', value: 'username' },
            { label: 'Created at', value: 'create_at' },
            { label: 'Last activity at', value: 'last_activity_at' },
            { label: 'Status', value: 'status' },
          ],
        },
      ],
      run: userGetAll,
    },
    {
      id: 'user_get_by_email',
      label: 'Get user by email',
      description: 'Fetch a user by email address.',
      fields: [{ id: 'email', label: 'Email', type: 'text', required: true }],
      run: userGetByEmail,
    },
    {
      id: 'user_get_by_id',
      label: 'Get users by IDs',
      description: 'Fetch users by a comma-separated list of IDs.',
      fields: [
        { id: 'userIds', label: 'User IDs (comma-separated)', type: 'textarea', required: true },
        { id: 'since', label: 'Modified since (ISO date)', type: 'text' },
      ],
      run: userGetById,
    },
    {
      id: 'user_invite',
      label: 'Invite users by email',
      description: 'Invite users to a team by email.',
      fields: [
        { id: 'teamId', label: 'Team ID', type: 'text', required: true },
        { id: 'emails', label: 'Emails (comma-separated)', type: 'textarea', required: true },
      ],
      run: userInvite,
    },
  ],
};

registerForgeBlock(block);
export default block;
