/**
 * Forge block: Knock
 *
 * API: https://docs.knock.app/reference
 * Auth: `Authorization: Bearer <api_key>` (secret key).
 *
 * Operations covered:
 *   - user.identify             PUT    /v1/users/{id}
 *   - user.get                  GET    /v1/users/{id}
 *   - workflow.trigger          POST   /v1/workflows/{key}/trigger
 *   - message.list              GET    /v1/messages
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.knock.app';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Knock: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

function maybeJson(s: string): Record<string, unknown> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error('Knock: JSON field is invalid');
  }
}

async function userIdentify(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('Knock: userId is required');
  const body: Record<string, unknown> = maybeJson(asString(ctx.options.properties));
  const email = asString(ctx.options.email);
  const name = asString(ctx.options.name);
  if (email) body.email = email;
  if (name) body.name = name;
  const res = await apiRequest({
    service: 'Knock',
    method: 'PUT',
    url: `${API}/v1/users/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { user: res.data }, logs: [`Knock user identify → ${id}`] };
}

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('Knock: userId is required');
  const res = await apiRequest({
    service: 'Knock',
    method: 'GET',
    url: `${API}/v1/users/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { user: res.data }, logs: [`Knock user get → ${id}`] };
}

async function workflowTrigger(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.workflowKey);
  if (!key) throw new Error('Knock: workflowKey is required');
  const recipientsRaw = asString(ctx.options.recipients);
  if (!recipientsRaw) throw new Error('Knock: recipients is required (comma list or JSON array)');
  let recipients: unknown;
  try {
    recipients = JSON.parse(recipientsRaw);
  } catch {
    recipients = recipientsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const body: Record<string, unknown> = {
    recipients,
    data: maybeJson(asString(ctx.options.data)),
  };
  const actor = asString(ctx.options.actor);
  if (actor) body.actor = actor;
  const res = await apiRequest({
    service: 'Knock',
    method: 'POST',
    url: `${API}/v1/workflows/${encodeURIComponent(key)}/trigger`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { workflow: res.data }, logs: [`Knock workflow trigger → ${key}`] };
}

async function messageList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const pageSize = asString(ctx.options.pageSize);
  const after = asString(ctx.options.after);
  if (pageSize) params.set('page_size', pageSize);
  if (after) params.set('after', after);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Knock',
    method: 'GET',
    url: `${API}/v1/messages${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { messages: res.data }, logs: ['Knock message list'] };
}

const block: ForgeBlock = {
  id: 'forge_knock',
  name: 'Knock',
  description: 'Knock notifications: users, workflows and message logs.',
  iconName: 'LuBell',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'user_identify',
      label: 'Identify user',
      description: 'Create or update a Knock user.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'properties', label: 'Properties JSON', type: 'textarea' },
      ],
      run: userIdentify,
    },
    {
      id: 'user_get',
      label: 'Get user',
      description: 'Fetch a user by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: userGet,
    },
    {
      id: 'workflow_trigger',
      label: 'Trigger workflow',
      description: 'Trigger a Knock workflow for one or more recipients.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workflowKey', label: 'Workflow key', type: 'text', required: true },
        { id: 'recipients', label: 'Recipients (CSV or JSON)', type: 'text', required: true },
        { id: 'actor', label: 'Actor (optional user id)', type: 'text' },
        { id: 'data', label: 'Data JSON', type: 'textarea' },
      ],
      run: workflowTrigger,
    },
    {
      id: 'message_list',
      label: 'List messages',
      description: 'List recent messages.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'pageSize', label: 'Page size', type: 'number' },
        { id: 'after', label: 'After (cursor)', type: 'text' },
      ],
      run: messageList,
    },
  ],
};

registerForgeBlock(block);
export default block;
