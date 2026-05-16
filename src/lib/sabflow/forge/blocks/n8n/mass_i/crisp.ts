/**
 * Forge block: Crisp
 *
 * API: https://docs.crisp.chat/api/v1/
 * Auth: HTTP Basic — `identifier:key` plus `X-Crisp-Tier: plugin` header.
 *
 * Operations covered:
 *   - profile.get               GET    /website/{wid}/people/profile/{peopleId}
 *   - profile.create            POST   /website/{wid}/people/profile
 *   - conversation.list         GET    /website/{wid}/conversations/{pageNum}
 *   - message.send              POST   /website/{wid}/conversation/{sessionId}/message
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.crisp.chat/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const id = asString(ctx.options.identifier);
  const key = asString(ctx.options.apiKey);
  if (!id || !key) throw new Error('Crisp: identifier and apiKey are required');
  const token = Buffer.from(`${id}:${key}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'X-Crisp-Tier': 'plugin' };
}

function requireWebsite(ctx: ForgeActionContext): string {
  const w = asString(ctx.options.websiteId);
  if (!w) throw new Error('Crisp: websiteId is required');
  return w;
}

async function profileGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const wid = requireWebsite(ctx);
  const id = asString(ctx.options.peopleId);
  if (!id) throw new Error('Crisp: peopleId is required');
  const res = await apiRequest({
    service: 'Crisp',
    method: 'GET',
    url: `${API}/website/${encodeURIComponent(wid)}/people/profile/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { profile: res.data }, logs: [`Crisp profile get → ${id}`] };
}

async function profileCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const wid = requireWebsite(ctx);
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Crisp: email is required');
  const body: Record<string, unknown> = { email };
  const personName = asString(ctx.options.personName);
  if (personName) body.person = { nickname: personName };
  const res = await apiRequest({
    service: 'Crisp',
    method: 'POST',
    url: `${API}/website/${encodeURIComponent(wid)}/people/profile`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { profile: res.data }, logs: [`Crisp profile create → ${email}`] };
}

async function conversationList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const wid = requireWebsite(ctx);
  const page = asString(ctx.options.page) || '1';
  const res = await apiRequest({
    service: 'Crisp',
    method: 'GET',
    url: `${API}/website/${encodeURIComponent(wid)}/conversations/${encodeURIComponent(page)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { conversations: res.data }, logs: [`Crisp conversation list → p${page}`] };
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const wid = requireWebsite(ctx);
  const sessionId = asString(ctx.options.sessionId);
  const content = asString(ctx.options.content);
  if (!sessionId || !content) throw new Error('Crisp: sessionId and content are required');
  const body = {
    type: 'text',
    content,
    from: 'operator',
    origin: 'chat',
  };
  const res = await apiRequest({
    service: 'Crisp',
    method: 'POST',
    url: `${API}/website/${encodeURIComponent(wid)}/conversation/${encodeURIComponent(sessionId)}/message`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { message: res.data }, logs: [`Crisp message send → ${sessionId}`] };
}

const block: ForgeBlock = {
  id: 'forge_crisp',
  name: 'Crisp',
  description: 'Crisp profiles, conversations and operator messages.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'profile_get',
      label: 'Get profile',
      description: 'Fetch a person profile by id.',
      fields: [
        { id: 'identifier', label: 'Plugin identifier', type: 'text', required: true },
        { id: 'apiKey', label: 'Plugin key', type: 'password', required: true },
        { id: 'websiteId', label: 'Website ID', type: 'text', required: true },
        { id: 'peopleId', label: 'People ID', type: 'text', required: true },
      ],
      run: profileGet,
    },
    {
      id: 'profile_create',
      label: 'Create profile',
      description: 'Create a new people profile.',
      fields: [
        { id: 'identifier', label: 'Plugin identifier', type: 'text', required: true },
        { id: 'apiKey', label: 'Plugin key', type: 'password', required: true },
        { id: 'websiteId', label: 'Website ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'personName', label: 'Nickname', type: 'text' },
      ],
      run: profileCreate,
    },
    {
      id: 'conversation_list',
      label: 'List conversations',
      description: 'List conversations (paged).',
      fields: [
        { id: 'identifier', label: 'Plugin identifier', type: 'text', required: true },
        { id: 'apiKey', label: 'Plugin key', type: 'password', required: true },
        { id: 'websiteId', label: 'Website ID', type: 'text', required: true },
        { id: 'page', label: 'Page', type: 'number', defaultValue: '1' },
      ],
      run: conversationList,
    },
    {
      id: 'message_send',
      label: 'Send message',
      description: 'Send a text message to a conversation as operator.',
      fields: [
        { id: 'identifier', label: 'Plugin identifier', type: 'text', required: true },
        { id: 'apiKey', label: 'Plugin key', type: 'password', required: true },
        { id: 'websiteId', label: 'Website ID', type: 'text', required: true },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: messageSend,
    },
  ],
};

registerForgeBlock(block);
export default block;
