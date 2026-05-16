/**
 * Forge block: LiveChat
 *
 * API: https://developers.livechat.com/docs/messaging/agent-chat-api
 * Auth: `Authorization: Bearer <pat>` plus `X-Region` (if account-region pinned).
 *
 * Operations covered (Configuration v3.5):
 *   - agent.list                POST  /v3.5/configuration/action/list_agents
 *   - agent.get                 POST  /v3.5/configuration/action/get_agent
 *   - chat.list                 POST  /v3.5/agent/action/list_archives
 *   - chat.send_event           POST  /v3.5/agent/action/send_event
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.livechatinc.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('LiveChat: accessToken is required');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const region = asString(ctx.options.region);
  if (region) headers['X-Region'] = region;
  return headers;
}

async function agentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'LiveChat',
    method: 'POST',
    url: `${API}/v3.5/configuration/action/list_agents`,
    headers: authHeaders(ctx),
    json: {},
  });
  return { outputs: { agents: res.data }, logs: ['LiveChat agent list'] };
}

async function agentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.agentId);
  if (!id) throw new Error('LiveChat: agentId is required');
  const res = await apiRequest({
    service: 'LiveChat',
    method: 'POST',
    url: `${API}/v3.5/configuration/action/get_agent`,
    headers: authHeaders(ctx),
    json: { id },
  });
  return { outputs: { agent: res.data }, logs: [`LiveChat agent get → ${id}`] };
}

async function chatList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const body: Record<string, unknown> = {};
  const limit = asString(ctx.options.limit);
  if (limit) body.limit = Number(limit);
  const res = await apiRequest({
    service: 'LiveChat',
    method: 'POST',
    url: `${API}/v3.5/agent/action/list_archives`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { chats: res.data }, logs: ['LiveChat chat list'] };
}

async function chatSendEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const text = asString(ctx.options.text);
  if (!chatId || !text) throw new Error('LiveChat: chatId and text are required');
  const body = {
    chat_id: chatId,
    event: { type: 'message', text, recipients: 'all' },
  };
  const res = await apiRequest({
    service: 'LiveChat',
    method: 'POST',
    url: `${API}/v3.5/agent/action/send_event`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { event: res.data }, logs: [`LiveChat send_event → ${chatId}`] };
}

const block: ForgeBlock = {
  id: 'forge_livechat',
  name: 'LiveChat',
  description: 'LiveChat agent + configuration API.',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'agent_list',
      label: 'List agents',
      description: 'List all agents.',
      fields: [
        { id: 'accessToken', label: 'Access token (PAT)', type: 'password', required: true },
        { id: 'region', label: 'Region', type: 'text' },
      ],
      run: agentList,
    },
    {
      id: 'agent_get',
      label: 'Get agent',
      description: 'Fetch an agent by id (email).',
      fields: [
        { id: 'accessToken', label: 'Access token (PAT)', type: 'password', required: true },
        { id: 'region', label: 'Region', type: 'text' },
        { id: 'agentId', label: 'Agent ID', type: 'text', required: true },
      ],
      run: agentGet,
    },
    {
      id: 'chat_list',
      label: 'List archived chats',
      description: 'List chat archives.',
      fields: [
        { id: 'accessToken', label: 'Access token (PAT)', type: 'password', required: true },
        { id: 'region', label: 'Region', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: chatList,
    },
    {
      id: 'chat_send_event',
      label: 'Send chat message',
      description: 'Post a message event to a chat.',
      fields: [
        { id: 'accessToken', label: 'Access token (PAT)', type: 'password', required: true },
        { id: 'region', label: 'Region', type: 'text' },
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run: chatSendEvent,
    },
  ],
};

registerForgeBlock(block);
export default block;
