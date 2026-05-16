/**
 * Forge block: Tawk.to
 *
 * API: https://developer.tawk.to/
 * Auth: `Authorization: Bearer <api_key>`.
 *
 * Operations covered:
 *   - property.list             GET    /v1/properties
 *   - chat.list                 GET    /v3/properties/{prop}/chats
 *   - chat.get                  GET    /v3/properties/{prop}/chats/{chatId}
 *   - contact.create            POST   /v3/properties/{prop}/contacts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.tawk.to';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Tawk.to: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

function requireProperty(ctx: ForgeActionContext): string {
  const p = asString(ctx.options.propertyId);
  if (!p) throw new Error('Tawk.to: propertyId is required');
  return p;
}

async function propertyList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Tawk.to',
    method: 'GET',
    url: `${API}/v1/properties`,
    headers: authHeader(ctx),
  });
  return { outputs: { properties: res.data }, logs: ['Tawk.to property list'] };
}

async function chatList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prop = requireProperty(ctx);
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Tawk.to',
    method: 'GET',
    url: `${API}/v3/properties/${encodeURIComponent(prop)}/chats${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { chats: res.data }, logs: [`Tawk.to chat list → ${prop}`] };
}

async function chatGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prop = requireProperty(ctx);
  const id = asString(ctx.options.chatId);
  if (!id) throw new Error('Tawk.to: chatId is required');
  const res = await apiRequest({
    service: 'Tawk.to',
    method: 'GET',
    url: `${API}/v3/properties/${encodeURIComponent(prop)}/chats/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { chat: res.data }, logs: [`Tawk.to chat get → ${id}`] };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prop = requireProperty(ctx);
  const email = asString(ctx.options.email);
  const name = asString(ctx.options.name);
  if (!email) throw new Error('Tawk.to: email is required');
  const body: Record<string, unknown> = { email };
  if (name) body.name = name;
  const res = await apiRequest({
    service: 'Tawk.to',
    method: 'POST',
    url: `${API}/v3/properties/${encodeURIComponent(prop)}/contacts`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { contact: res.data }, logs: [`Tawk.to contact create → ${email}`] };
}

const block: ForgeBlock = {
  id: 'forge_tawk',
  name: 'Tawk.to',
  description: 'Tawk.to properties, chats and contacts.',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'property_list',
      label: 'List properties',
      description: 'List all properties for the account.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: propertyList,
    },
    {
      id: 'chat_list',
      label: 'List chats',
      description: 'List chats for a property.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'propertyId', label: 'Property ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: chatList,
    },
    {
      id: 'chat_get',
      label: 'Get chat',
      description: 'Fetch a single chat transcript.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'propertyId', label: 'Property ID', type: 'text', required: true },
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
      ],
      run: chatGet,
    },
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Add a contact to a property.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'propertyId', label: 'Property ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
      ],
      run: contactCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
