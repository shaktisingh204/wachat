/**
 * Forge block: Front
 *
 * API: https://dev.frontapp.com/reference/introduction
 * Auth: `Authorization: Bearer <api_token>`.
 *
 * Operations covered:
 *   - contact.create            POST   /contacts
 *   - contact.get               GET    /contacts/{id}
 *   - conversation.list         GET    /conversations
 *   - message.send              POST   /channels/{channel_id}/messages
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api2.frontapp.com';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiToken);
  if (!key) throw new Error('Front: apiToken is required');
  return { Authorization: `Bearer ${key}` };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const name = asString(ctx.options.name);
  if (!email) throw new Error('Front: email is required');
  const body: Record<string, unknown> = {
    handles: [{ handle: email, source: 'email' }],
  };
  if (name) body.name = name;
  const res = await apiRequest({
    service: 'Front',
    method: 'POST',
    url: `${API}/contacts`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { contact: res.data }, logs: [`Front contact create → ${email}`] };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Front: contactId is required');
  const res = await apiRequest({
    service: 'Front',
    method: 'GET',
    url: `${API}/contacts/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { contact: res.data }, logs: [`Front contact get → ${id}`] };
}

async function conversationList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const q = asString(ctx.options.query);
  const limit = asString(ctx.options.limit);
  if (q) params.set('q', q);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Front',
    method: 'GET',
    url: `${API}/conversations${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { conversations: res.data }, logs: ['Front conversation list'] };
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channelId = asString(ctx.options.channelId);
  const to = asString(ctx.options.to);
  const bodyText = asString(ctx.options.body);
  if (!channelId || !to || !bodyText) throw new Error('Front: channelId, to and body are required');
  const json: Record<string, unknown> = {
    to: to.split(',').map((s) => s.trim()).filter(Boolean),
    body: bodyText,
  };
  const subject = asString(ctx.options.subject);
  if (subject) json.subject = subject;
  const res = await apiRequest({
    service: 'Front',
    method: 'POST',
    url: `${API}/channels/${encodeURIComponent(channelId)}/messages`,
    headers: authHeader(ctx),
    json,
  });
  return { outputs: { message: res.data }, logs: [`Front message send → ${to}`] };
}

const block: ForgeBlock = {
  id: 'forge_front',
  name: 'Front',
  description: 'Front conversations, contacts and outbound messages.',
  iconName: 'LuInbox',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Add a contact by email handle.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
      ],
      run: contactGet,
    },
    {
      id: 'conversation_list',
      label: 'List conversations',
      description: 'Search/list conversations.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'query', label: 'Search query', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: conversationList,
    },
    {
      id: 'message_send',
      label: 'Send message',
      description: 'Send an outbound message on a channel.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'to', label: 'To (CSV)', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'body', label: 'Body', type: 'textarea', required: true },
      ],
      run: messageSend,
    },
  ],
};

registerForgeBlock(block);
export default block;
