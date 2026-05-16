/**
 * Forge block: Gotify
 *
 * Source: n8n-master/packages/nodes-base/nodes/Gotify/Gotify.node.ts
 *
 * Self-hosted server URL + appToken (POST) / clientToken (GET/DELETE).
 *
 * Operations covered:
 *   - message.create  POST    /message
 *   - message.list    GET     /message
 *   - message.delete  DELETE  /message/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const u = asString(ctx.options.serverUrl);
  if (!u) throw new Error('Gotify: serverUrl is required');
  return u.replace(/\/$/, '');
}

function appAuth(ctx: ForgeActionContext): Record<string, string> {
  const t = asString(ctx.options.appToken);
  if (!t) throw new Error('Gotify: appToken is required');
  return { 'X-Gotify-Key': t, Accept: 'application/json' };
}

function clientAuth(ctx: ForgeActionContext): Record<string, string> {
  const t = asString(ctx.options.clientToken);
  if (!t) throw new Error('Gotify: clientToken is required');
  return { 'X-Gotify-Key': t, Accept: 'application/json' };
}

async function messageCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const message = asString(ctx.options.message);
  if (!message) throw new Error('Gotify: message is required');
  const body: Record<string, unknown> = { message };
  const title = asString(ctx.options.title);
  if (title) body.title = title;
  const priority = asNumber(ctx.options.priority);
  if (priority !== undefined) body.priority = priority;
  const contentType = asString(ctx.options.contentType);
  if (contentType) {
    body.extras = { 'client::display': { contentType } };
  }
  const res = await apiRequest({
    service: 'Gotify',
    method: 'POST',
    url: `${baseUrl(ctx)}/message`,
    headers: appAuth(ctx),
    json: body,
  });
  return { outputs: { message: res.data }, logs: ['Gotify message created'] };
}

async function messageList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const limit = asNumber(ctx.options.limit);
  if (limit !== undefined) params.set('limit', String(limit));
  const url = `${baseUrl(ctx)}/message${params.toString() ? `?${params}` : ''}`;
  const res = await apiRequest({
    service: 'Gotify',
    method: 'GET',
    url,
    headers: clientAuth(ctx),
  });
  return { outputs: { messages: res.data }, logs: ['Gotify message list'] };
}

async function messageDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.messageId);
  if (!id) throw new Error('Gotify: messageId is required');
  const res = await apiRequest({
    service: 'Gotify',
    method: 'DELETE',
    url: `${baseUrl(ctx)}/message/${encodeURIComponent(id)}`,
    headers: clientAuth(ctx),
  });
  return { outputs: { ok: true, status: res.status }, logs: [`Gotify delete → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_gotify',
  name: 'Gotify',
  description: 'Send and manage messages via a self-hosted Gotify server.',
  iconName: 'LuBell',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'message_create',
      label: 'Send message',
      fields: [
        { id: 'serverUrl', label: 'Server URL', type: 'text', required: true, placeholder: 'https://gotify.example.com' },
        { id: 'appToken', label: 'Application token', type: 'password', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'number' },
        { id: 'contentType', label: 'Content type', type: 'select', options: [
          { label: 'Plain', value: 'text/plain' },
          { label: 'Markdown', value: 'text/markdown' },
        ] },
      ],
      run: messageCreate,
    },
    {
      id: 'message_list',
      label: 'List messages',
      fields: [
        { id: 'serverUrl', label: 'Server URL', type: 'text', required: true },
        { id: 'clientToken', label: 'Client token', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: messageList,
    },
    {
      id: 'message_delete',
      label: 'Delete message',
      fields: [
        { id: 'serverUrl', label: 'Server URL', type: 'text', required: true },
        { id: 'clientToken', label: 'Client token', type: 'password', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
      ],
      run: messageDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
