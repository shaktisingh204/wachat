/**
 * Forge block: Slack (extended actions, second set)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Slack/V2/SlackV2.node.ts
 *
 * A second tranche of ops complementary to slack_v2_actions.
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

async function fileUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channels = asString(ctx.options.channels);
  const content = asString(ctx.options.content);
  const filename = asString(ctx.options.filename) || 'file.txt';
  if (!channels || !content) throw new Error('Slack: channels and content are required');
  const form = new URLSearchParams({ channels, content, filename });
  const res = await apiRequest({
    service: 'Slack',
    method: 'POST',
    url: `${API}/files.upload`,
    headers: { ...headers(ctx), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  return { outputs: { file: res.data }, logs: [`Slack file upload → ${channels}`] };
}

async function userProfileGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const user = asString(ctx.options.user);
  if (!user) throw new Error('Slack: user is required');
  const res = await apiRequest({
    service: 'Slack',
    method: 'GET',
    url: `${API}/users.profile.get?user=${encodeURIComponent(user)}`,
    headers: headers(ctx),
  });
  return { outputs: { profile: res.data }, logs: [`Slack profile → ${user}`] };
}

async function channelKickUser(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channel = asString(ctx.options.channel);
  const user = asString(ctx.options.user);
  if (!channel || !user) throw new Error('Slack: channel and user are required');
  const res = await apiRequest({
    service: 'Slack',
    method: 'POST',
    url: `${API}/conversations.kick`,
    headers: headers(ctx),
    json: { channel, user },
  });
  return { outputs: { result: res.data }, logs: [`Slack kick → ${user}`] };
}

async function setTopic(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channel = asString(ctx.options.channel);
  const topic = asString(ctx.options.topic);
  if (!channel || !topic) throw new Error('Slack: channel and topic are required');
  const res = await apiRequest({
    service: 'Slack',
    method: 'POST',
    url: `${API}/conversations.setTopic`,
    headers: headers(ctx),
    json: { channel, topic },
  });
  return { outputs: { result: res.data }, logs: [`Slack topic → ${channel}`] };
}

const block: ForgeBlock = {
  id: 'forge_slack_ext',
  name: 'Slack (extra actions)',
  description: 'Additional Slack ops (file upload, profile, kick user, set topic).',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'file_upload',
      label: 'Upload file (text)',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'channels', label: 'Channels (CSV)', type: 'text', required: true },
        { id: 'content', label: 'Content (text)', type: 'textarea', required: true },
        { id: 'filename', label: 'Filename', type: 'text', defaultValue: 'file.txt' },
      ],
      run: fileUpload,
    },
    {
      id: 'user_profile_get',
      label: 'Get user profile',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'user', label: 'User ID', type: 'text', required: true },
      ],
      run: userProfileGet,
    },
    {
      id: 'channel_kick',
      label: 'Kick user from channel',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'channel', label: 'Channel ID', type: 'text', required: true },
        { id: 'user', label: 'User ID', type: 'text', required: true },
      ],
      run: channelKickUser,
    },
    {
      id: 'set_topic',
      label: 'Set channel topic',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'channel', label: 'Channel ID', type: 'text', required: true },
        { id: 'topic', label: 'Topic', type: 'text', required: true },
      ],
      run: setTopic,
    },
  ],
};

registerForgeBlock(block);
export default block;
