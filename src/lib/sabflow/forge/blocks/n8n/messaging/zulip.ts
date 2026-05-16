/**
 * Forge block: Zulip
 *
 * Source: n8n-master/packages/nodes-base/nodes/Zulip/Zulip.node.ts
 *
 * Basic auth (email:apiKey), base URL from input. Credentials inline.
 *
 * Operations covered:
 *   - message.send     POST   /api/v1/messages  (stream + private)
 *   - message.update   PATCH  /api/v1/messages/{id}
 *   - message.get      GET    /api/v1/messages/{id}
 *   - stream.list      GET    /api/v1/streams
 *   - user.list        GET    /api/v1/users
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

type Creds = { baseUrl: string; auth: string };

function creds(ctx: ForgeActionContext): Creds {
  const url = asString(ctx.options.baseUrl);
  const email = asString(ctx.options.email);
  const apiKey = asString(ctx.options.apiKey);
  if (!url) throw new Error('Zulip: baseUrl is required');
  if (!email) throw new Error('Zulip: email is required');
  if (!apiKey) throw new Error('Zulip: apiKey is required');
  const baseUrl = url.replace(/\/$/, '');
  const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');
  return { baseUrl, auth };
}

function authHeaders(c: Creds): Record<string, string> {
  return {
    Authorization: `Basic ${c.auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function toForm(body: Record<string, string>): string {
  return Object.entries(body)
    .filter(([, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = creds(ctx);
  const messageType = asString(ctx.options.messageType) || 'stream';
  const to = asString(ctx.options.to);
  const content = asString(ctx.options.content);
  if (!to) throw new Error('Zulip: to is required');
  if (!content) throw new Error('Zulip: content is required');

  const body: Record<string, string> = { type: messageType, to, content };
  if (messageType === 'stream') {
    const topic = asString(ctx.options.topic);
    if (!topic) throw new Error('Zulip: topic is required for stream messages');
    body.topic = topic;
  }
  const res = await apiRequest({
    service: 'Zulip',
    method: 'POST',
    url: `${c.baseUrl}/api/v1/messages`,
    headers: authHeaders(c),
    body: toForm(body),
  });
  return { outputs: { result: res.data }, logs: [`Zulip message → ${to}`] };
}

async function messageUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = creds(ctx);
  const id = asString(ctx.options.messageId);
  if (!id) throw new Error('Zulip: messageId is required');
  const body: Record<string, string> = {};
  const content = asString(ctx.options.content);
  if (content) body.content = content;
  const topic = asString(ctx.options.topic);
  if (topic) body.topic = topic;
  const res = await apiRequest({
    service: 'Zulip',
    method: 'PATCH',
    url: `${c.baseUrl}/api/v1/messages/${encodeURIComponent(id)}`,
    headers: authHeaders(c),
    body: toForm(body),
  });
  return { outputs: { result: res.data }, logs: [`Zulip update → ${id}`] };
}

async function messageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = creds(ctx);
  const id = asString(ctx.options.messageId);
  if (!id) throw new Error('Zulip: messageId is required');
  const res = await apiRequest({
    service: 'Zulip',
    method: 'GET',
    url: `${c.baseUrl}/api/v1/messages/${encodeURIComponent(id)}`,
    headers: { Authorization: `Basic ${c.auth}` },
  });
  return { outputs: { message: res.data }, logs: [`Zulip get → ${id}`] };
}

async function streamList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = creds(ctx);
  const res = await apiRequest({
    service: 'Zulip',
    method: 'GET',
    url: `${c.baseUrl}/api/v1/streams`,
    headers: { Authorization: `Basic ${c.auth}` },
  });
  return { outputs: { streams: res.data }, logs: ['Zulip stream list'] };
}

async function userList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = creds(ctx);
  const res = await apiRequest({
    service: 'Zulip',
    method: 'GET',
    url: `${c.baseUrl}/api/v1/users`,
    headers: { Authorization: `Basic ${c.auth}` },
  });
  return { outputs: { users: res.data }, logs: ['Zulip user list'] };
}

const baseFields = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'https://yourzulip.zulipchat.com' },
  { id: 'email', label: 'Bot email', type: 'text' as const, required: true },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_zulip',
  name: 'Zulip',
  description: 'Send messages and list streams/users on a Zulip instance.',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'message_send',
      label: 'Send message',
      description: 'Send a stream or private message.',
      fields: [
        ...baseFields,
        { id: 'messageType', label: 'Type', type: 'select', options: [
          { label: 'Stream', value: 'stream' },
          { label: 'Private', value: 'private' },
        ], defaultValue: 'stream' },
        { id: 'to', label: 'To (stream name or comma-separated emails)', type: 'text', required: true },
        { id: 'topic', label: 'Topic (stream only)', type: 'text' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: messageSend,
    },
    {
      id: 'message_update',
      label: 'Update message',
      fields: [
        ...baseFields,
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
        { id: 'content', label: 'New content', type: 'textarea' },
        { id: 'topic', label: 'New topic', type: 'text' },
      ],
      run: messageUpdate,
    },
    {
      id: 'message_get',
      label: 'Get message',
      fields: [
        ...baseFields,
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
      ],
      run: messageGet,
    },
    {
      id: 'stream_list',
      label: 'List streams',
      fields: baseFields,
      run: streamList,
    },
    {
      id: 'user_list',
      label: 'List users',
      fields: baseFields,
      run: userList,
    },
  ],
};

registerForgeBlock(block);
export default block;
