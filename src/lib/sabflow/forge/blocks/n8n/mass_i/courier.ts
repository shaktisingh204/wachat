/**
 * Forge block: Courier
 *
 * API: https://www.courier.com/docs/reference/
 * Auth: `Authorization: Bearer <api_key>`.
 *
 * Operations covered:
 *   - send                      POST   /send
 *   - message.get               GET    /messages/{id}
 *   - profile.replace           PUT    /profiles/{user_id}
 *   - profile.get               GET    /profiles/{user_id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.courier.com';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Courier: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

function maybeJson(s: string): Record<string, unknown> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error('Courier: JSON field is invalid');
  }
}

async function send(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId);
  const templateId = asString(ctx.options.templateId);
  if (!userId) throw new Error('Courier: userId is required');
  if (!templateId) throw new Error('Courier: templateId is required');
  const message: Record<string, unknown> = {
    to: { user_id: userId },
    template: templateId,
    data: maybeJson(asString(ctx.options.data)),
  };
  const res = await apiRequest({
    service: 'Courier',
    method: 'POST',
    url: `${API}/send`,
    headers: authHeader(ctx),
    json: { message },
  });
  return { outputs: { result: res.data }, logs: [`Courier send → ${templateId}`] };
}

async function messageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.messageId);
  if (!id) throw new Error('Courier: messageId is required');
  const res = await apiRequest({
    service: 'Courier',
    method: 'GET',
    url: `${API}/messages/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { message: res.data }, logs: [`Courier message get → ${id}`] };
}

async function profileReplace(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId);
  if (!userId) throw new Error('Courier: userId is required');
  const body = { profile: maybeJson(asString(ctx.options.profile)) };
  const res = await apiRequest({
    service: 'Courier',
    method: 'PUT',
    url: `${API}/profiles/${encodeURIComponent(userId)}`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { profile: res.data }, logs: [`Courier profile replace → ${userId}`] };
}

async function profileGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId);
  if (!userId) throw new Error('Courier: userId is required');
  const res = await apiRequest({
    service: 'Courier',
    method: 'GET',
    url: `${API}/profiles/${encodeURIComponent(userId)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { profile: res.data }, logs: [`Courier profile get → ${userId}`] };
}

const block: ForgeBlock = {
  id: 'forge_courier',
  name: 'Courier',
  description: 'Send notifications and manage profiles in Courier.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send',
      label: 'Send notification',
      description: 'Send a templated notification to a user.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'templateId', label: 'Template ID', type: 'text', required: true },
        { id: 'data', label: 'Data JSON', type: 'textarea' },
      ],
      run: send,
    },
    {
      id: 'message_get',
      label: 'Get message',
      description: 'Fetch a message by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
      ],
      run: messageGet,
    },
    {
      id: 'profile_replace',
      label: 'Replace profile',
      description: 'Replace a user profile.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'profile', label: 'Profile JSON', type: 'textarea', required: true },
      ],
      run: profileReplace,
    },
    {
      id: 'profile_get',
      label: 'Get profile',
      description: 'Fetch a user profile.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: profileGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
