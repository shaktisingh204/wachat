/**
 * Forge block: Microsoft Teams V1
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Teams/v1/MicrosoftTeamsV1.node.ts
 *
 * Bearer token (Microsoft Graph) passed inline.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://graph.microsoft.com/v1.0';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('MS Teams: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function teamsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'MS Teams',
    method: 'GET',
    url: `${API}/me/joinedTeams`,
    headers: headers(ctx),
  });
  return { outputs: { teams: res.data }, logs: ['MS Teams list'] };
}

async function channelsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const teamId = asString(ctx.options.teamId);
  if (!teamId) throw new Error('MS Teams: teamId is required');
  const res = await apiRequest({
    service: 'MS Teams',
    method: 'GET',
    url: `${API}/teams/${encodeURIComponent(teamId)}/channels`,
    headers: headers(ctx),
  });
  return { outputs: { channels: res.data }, logs: [`MS Teams channels → ${teamId}`] };
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const teamId = asString(ctx.options.teamId);
  const channelId = asString(ctx.options.channelId);
  const message = asString(ctx.options.message);
  if (!teamId || !channelId || !message)
    throw new Error('MS Teams: teamId, channelId and message are required');
  const res = await apiRequest({
    service: 'MS Teams',
    method: 'POST',
    url: `${API}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
    headers: headers(ctx),
    json: { body: { content: message } },
  });
  return { outputs: { result: res.data }, logs: [`MS Teams message → ${channelId}`] };
}

const block: ForgeBlock = {
  id: 'forge_ms_teams_v1',
  name: 'Microsoft Teams V1',
  description: 'List teams/channels and send messages (Teams V1 API).',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'teams_list',
      label: 'List joined teams',
      fields: [{ id: 'accessToken', label: 'Access token', type: 'password', required: true }],
      run: teamsList,
    },
    {
      id: 'channels_list',
      label: 'List channels',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'teamId', label: 'Team ID', type: 'text', required: true },
      ],
      run: channelsList,
    },
    {
      id: 'message_send',
      label: 'Send channel message',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'teamId', label: 'Team ID', type: 'text', required: true },
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'message', label: 'Message HTML', type: 'textarea', required: true },
      ],
      run: messageSend,
    },
  ],
};

registerForgeBlock(block);
export default block;
