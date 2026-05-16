/**
 * Forge block: Slack V2 (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Slack/V2/SlackV2.node.ts
 *
 * Inline Slack Bot Token (`xoxb-…`) passed as a password field.
 * Covers a handful of useful ops not in the modern slack block.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://slack.com/api';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.botToken);
  if (!token) throw new Error('Slack: botToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function channelArchive(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channel = asString(ctx.options.channel);
  if (!channel) throw new Error('Slack: channel is required');
  const res = await apiRequest({
    service: 'Slack',
    method: 'POST',
    url: `${API}/conversations.archive`,
    headers: headers(ctx),
    json: { channel },
  });
  return { outputs: { result: res.data }, logs: [`Slack archive → ${channel}`] };
}

async function channelInvite(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channel = asString(ctx.options.channel);
  const users = asString(ctx.options.users);
  if (!channel || !users) throw new Error('Slack: channel and users are required');
  const res = await apiRequest({
    service: 'Slack',
    method: 'POST',
    url: `${API}/conversations.invite`,
    headers: headers(ctx),
    json: { channel, users },
  });
  return { outputs: { result: res.data }, logs: [`Slack invite → ${channel}`] };
}

async function userInfo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const user = asString(ctx.options.user);
  if (!user) throw new Error('Slack: user is required');
  const res = await apiRequest({
    service: 'Slack',
    method: 'GET',
    url: `${API}/users.info?user=${encodeURIComponent(user)}`,
    headers: headers(ctx),
  });
  return { outputs: { user: res.data }, logs: [`Slack user.info → ${user}`] };
}

async function reactionAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channel = asString(ctx.options.channel);
  const timestamp = asString(ctx.options.timestamp);
  const name = asString(ctx.options.name);
  if (!channel || !timestamp || !name)
    throw new Error('Slack: channel, timestamp and name are required');
  const res = await apiRequest({
    service: 'Slack',
    method: 'POST',
    url: `${API}/reactions.add`,
    headers: headers(ctx),
    json: { channel, timestamp, name },
  });
  return { outputs: { result: res.data }, logs: [`Slack reaction add → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_slack_v2_actions',
  name: 'Slack V2 (extended)',
  description: 'Extra Slack ops (archive, invite, user.info, reactions).',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'channel_archive',
      label: 'Archive channel',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'channel', label: 'Channel ID', type: 'text', required: true },
      ],
      run: channelArchive,
    },
    {
      id: 'channel_invite',
      label: 'Invite users to channel',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'channel', label: 'Channel ID', type: 'text', required: true },
        { id: 'users', label: 'User IDs (CSV)', type: 'text', required: true },
      ],
      run: channelInvite,
    },
    {
      id: 'user_info',
      label: 'Get user info',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'user', label: 'User ID', type: 'text', required: true },
      ],
      run: userInfo,
    },
    {
      id: 'reaction_add',
      label: 'Add reaction',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'channel', label: 'Channel ID', type: 'text', required: true },
        { id: 'timestamp', label: 'Message ts', type: 'text', required: true },
        { id: 'name', label: 'Emoji name', type: 'text', required: true, placeholder: 'thumbsup' },
      ],
      run: reactionAdd,
    },
  ],
};

registerForgeBlock(block);
export default block;
