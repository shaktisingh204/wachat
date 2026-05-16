/**
 * Forge block: Discord (extended actions, v2 ops)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Discord/v2/DiscordV2.node.ts
 *
 * Uses a Discord Bot token (`Bot xxx`). Extra ops not in primary discord block.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://discord.com/api/v10';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.botToken);
  if (!token) throw new Error('Discord: botToken is required');
  return { Authorization: `Bot ${token}` };
}

async function channelGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  if (!channelId) throw new Error('Discord: channelId is required');
  const res = await apiRequest({
    service: 'Discord',
    method: 'GET',
    url: `${API}/channels/${encodeURIComponent(channelId)}`,
    headers: headers(ctx),
  });
  return { outputs: { channel: res.data }, logs: [`Discord channel get → ${channelId}`] };
}

async function memberList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const guildId = asString(ctx.options.guildId);
  if (!guildId) throw new Error('Discord: guildId is required');
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  if (limit) params.set('limit', limit);
  const path = `/guilds/${encodeURIComponent(guildId)}/members${params.size ? `?${params.toString()}` : ''}`;
  const res = await apiRequest({
    service: 'Discord',
    method: 'GET',
    url: `${API}${path}`,
    headers: headers(ctx),
  });
  return { outputs: { members: res.data }, logs: [`Discord member list → ${guildId}`] };
}

async function memberKick(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const guildId = asString(ctx.options.guildId);
  const userId = asString(ctx.options.userId);
  if (!guildId || !userId) throw new Error('Discord: guildId and userId are required');
  const res = await apiRequest({
    service: 'Discord',
    method: 'DELETE',
    url: `${API}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data, status: res.status }, logs: [`Discord kick → ${userId}`] };
}

async function messageDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  const messageId = asString(ctx.options.messageId);
  if (!channelId || !messageId) throw new Error('Discord: channelId and messageId are required');
  const res = await apiRequest({
    service: 'Discord',
    method: 'DELETE',
    url: `${API}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
    headers: headers(ctx),
  });
  return { outputs: { status: res.status }, logs: [`Discord delete message → ${messageId}`] };
}

const block: ForgeBlock = {
  id: 'forge_discord_ext',
  name: 'Discord (extended)',
  description: 'Discord ops (channel info, member list, kick, delete message).',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'channel_get',
      label: 'Get channel',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
      ],
      run: channelGet,
    },
    {
      id: 'member_list',
      label: 'List guild members',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'guildId', label: 'Guild ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 100 },
      ],
      run: memberList,
    },
    {
      id: 'member_kick',
      label: 'Kick member',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'guildId', label: 'Guild ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: memberKick,
    },
    {
      id: 'message_delete',
      label: 'Delete message',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
      ],
      run: messageDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
