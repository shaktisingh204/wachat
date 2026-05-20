/**
 * Forge block: Twake
 *
 * Source: n8n-master/packages/nodes-base/nodes/Twake/Twake.node.ts
 *
 * Twake cloud plugin uses a workspaceKey passed as Authorization header.
 * Credentials inline as password fields.
 *
 * Operations covered:
 *   - message.send  POST https://plugins.twake.app/plugins/n8n/actions/message/save
 *   - channel.list  POST https://plugins.twake.app/plugins/n8n/channel
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://plugins.twake.app/plugins/n8n';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.workspaceKey);
  if (!key) throw new Error('Twake: workspaceKey is required');
  return { Authorization: `Bearer ${key}` };
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  const content = asString(ctx.options.content);
  if (!channelId) throw new Error('Twake: channelId is required');
  if (!content) throw new Error('Twake: content is required');

  const senderName = asString(ctx.options.senderName);
  const senderIcon = asString(ctx.options.senderIcon);
  const hiddenData: Record<string, unknown> = { allow_delete: 'everyone' };
  if (senderName) hiddenData.custom_title = senderName;
  if (senderIcon) hiddenData.custom_icon = senderIcon;

  const body = {
    object: {
      channel_id: channelId,
      content: { formatted: content },
      hidden_data: hiddenData,
    },
  };

  const res = await apiRequest({
    service: 'Twake',
    method: 'POST',
    url: `${API}/actions/message/save`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { message: res.data }, logs: [`Twake message → ${channelId}`] };
}

async function channelList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Twake',
    method: 'POST',
    url: `${API}/channel`,
    headers: authHeader(ctx),
    json: {},
  });
  return { outputs: { channels: res.data }, logs: ['Twake channel list'] };
}

async function customAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  if (!path) throw new Error('Twake: path is required');
  const method = (asString(ctx.options.method) || 'POST').toUpperCase() as 'GET' | 'POST';
  const bodyStr = asString(ctx.options.body);
  let json: unknown = {};
  if (bodyStr) {
    try {
      json = JSON.parse(bodyStr);
    } catch {
      throw new Error('Twake: body must be valid JSON');
    }
  }
  const res = await apiRequest({
    service: 'Twake',
    method,
    url: `${API}${path.startsWith('/') ? path : `/${path}`}`,
    headers: authHeader(ctx),
    json: method === 'POST' ? json : undefined,
  });
  return { outputs: { result: res.data }, logs: [`Twake ${method} ${path}`] };
}

const block: ForgeBlock = {
  id: 'forge_twake',
  name: 'Twake',
  description: 'Send messages and list channels through Twake cloud plugin.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'message_send',
      label: 'Send message',
      description: 'Post a message to a Twake channel.',
      fields: [
        { id: 'workspaceKey', label: 'Workspace key', type: 'password', required: true },
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'senderName', label: 'Sender name', type: 'text' },
        { id: 'senderIcon', label: 'Sender icon URL', type: 'text' },
      ],
      run: messageSend,
    },
    {
      id: 'channel_list',
      label: 'List channels',
      description: 'Fetch channels visible to the workspace.',
      fields: [
        { id: 'workspaceKey', label: 'Workspace key', type: 'password', required: true },
      ],
      run: channelList,
    },
    {
      id: 'custom',
      label: 'Custom request',
      description: 'Send an arbitrary request to the Twake plugin endpoint.',
      fields: [
        { id: 'workspaceKey', label: 'Workspace key', type: 'password', required: true },
        { id: 'method', label: 'Method', type: 'select', options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
        ], defaultValue: 'POST' },
        { id: 'path', label: 'Path', type: 'text', required: true, placeholder: '/channel' },
        { id: 'body', label: 'JSON body', type: 'textarea' },
      ],
      run: customAction,
    },
  ],
};

registerForgeBlock(block);
export default block;
