/**
 * Forge block: Microsoft Teams (Graph)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Teams/{MicrosoftTeams.node.ts, v2}
 * Credential type: 'microsoft_teams' — { clientId, clientSecret, refreshToken }
 *
 * Operations (Graph v1.0):
 *   - team.list             GET  /me/joinedTeams
 *   - channel.list          GET  /teams/{teamId}/channels
 *   - channel.message.send  POST /teams/{teamId}/channels/{channelId}/messages
 *   - chat.message.send     POST /chats/{chatId}/messages
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, MICROSOFT_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://graph.microsoft.com/v1.0';
const SERVICE = 'Microsoft Teams';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, MICROSOFT_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

async function teamList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', `/me/joinedTeams`);
  return { outputs: { result: data }, logs: ['Teams joinedTeams'] };
}

async function channelList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const teamId = asString(ctx.options.teamId);
  if (!teamId) throw new Error(`${SERVICE}: teamId is required`);
  const data = await call(ctx, 'GET', `/teams/${encodeURIComponent(teamId)}/channels`);
  return { outputs: { result: data }, logs: [`Teams channels list → ${teamId}`] };
}

async function channelMessageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const teamId = asString(ctx.options.teamId);
  const channelId = asString(ctx.options.channelId);
  const content = asString(ctx.options.content);
  if (!teamId) throw new Error(`${SERVICE}: teamId is required`);
  if (!channelId) throw new Error(`${SERVICE}: channelId is required`);
  if (!content) throw new Error(`${SERVICE}: content is required`);
  const contentType = asString(ctx.options.contentType) || 'text';
  const body = { body: { contentType, content } };
  const data = await call(
    ctx,
    'POST',
    `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
    body,
  );
  return { outputs: { result: data }, logs: [`Teams channel message → ${channelId}`] };
}

async function chatMessageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const content = asString(ctx.options.content);
  if (!chatId) throw new Error(`${SERVICE}: chatId is required`);
  if (!content) throw new Error(`${SERVICE}: content is required`);
  const contentType = asString(ctx.options.contentType) || 'text';
  const body = { body: { contentType, content } };
  const data = await call(ctx, 'POST', `/chats/${encodeURIComponent(chatId)}/messages`, body);
  return { outputs: { result: data }, logs: [`Teams chat message → ${chatId}`] };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_teams_full',
  name: 'Microsoft Teams',
  description: 'List teams/channels and send channel or chat messages in Teams.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'microsoft_teams' },
  actions: [
    {
      id: 'team_list',
      label: 'List teams',
      description: 'List the signed-in user\'s joined teams.',
      fields: [],
      run: teamList,
    },
    {
      id: 'channel_list',
      label: 'List channels',
      description: 'List channels in a team.',
      fields: [{ id: 'teamId', label: 'Team ID', type: 'text', required: true }],
      run: channelList,
    },
    {
      id: 'channel_message_send',
      label: 'Send channel message',
      description: 'Post a message to a Teams channel.',
      fields: [
        { id: 'teamId', label: 'Team ID', type: 'text', required: true },
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        {
          id: 'contentType',
          label: 'Content type',
          type: 'select',
          options: [
            { label: 'text', value: 'text' },
            { label: 'html', value: 'html' },
          ],
          defaultValue: 'text',
        },
      ],
      run: channelMessageSend,
    },
    {
      id: 'chat_message_send',
      label: 'Send chat message',
      description: 'Post a message into a 1:1 or group chat.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        {
          id: 'contentType',
          label: 'Content type',
          type: 'select',
          options: [
            { label: 'text', value: 'text' },
            { label: 'html', value: 'html' },
          ],
          defaultValue: 'text',
        },
      ],
      run: chatMessageSend,
    },
  ],
};

registerForgeBlock(block);
export default block;
