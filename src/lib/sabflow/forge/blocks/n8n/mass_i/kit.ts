/**
 * Forge block: Kit (formerly ConvertKit)
 *
 * API: https://developers.kit.com/v4
 * Auth: `Authorization: Bearer <api_secret>` (v4 access token).
 *
 * Operations covered:
 *   - subscriber.create         POST   /v4/subscribers
 *   - subscriber.list           GET    /v4/subscribers
 *   - tag.add                   POST   /v4/tags/{tagId}/subscribers/{id}
 *   - broadcast.create          POST   /v4/broadcasts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.kit.com';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Kit: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

async function subscriberCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Kit: email is required');
  const body: Record<string, unknown> = { email_address: email };
  const firstName = asString(ctx.options.firstName);
  const state = asString(ctx.options.state);
  if (firstName) body.first_name = firstName;
  if (state) body.state = state;
  const res = await apiRequest({
    service: 'Kit',
    method: 'POST',
    url: `${API}/v4/subscribers`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { subscriber: res.data }, logs: [`Kit subscriber create → ${email}`] };
}

async function subscriberList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const status = asString(ctx.options.status);
  const perPage = asString(ctx.options.perPage);
  if (status) params.set('status', status);
  if (perPage) params.set('per_page', perPage);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Kit',
    method: 'GET',
    url: `${API}/v4/subscribers${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { subscribers: res.data }, logs: ['Kit subscriber list'] };
}

async function tagAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tagId = asString(ctx.options.tagId);
  const subscriberId = asString(ctx.options.subscriberId);
  if (!tagId || !subscriberId) throw new Error('Kit: tagId and subscriberId are required');
  const res = await apiRequest({
    service: 'Kit',
    method: 'POST',
    url: `${API}/v4/tags/${encodeURIComponent(tagId)}/subscribers/${encodeURIComponent(subscriberId)}`,
    headers: authHeader(ctx),
    json: {},
  });
  return { outputs: { result: res.data }, logs: [`Kit tag add → ${tagId}/${subscriberId}`] };
}

async function broadcastCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const content = asString(ctx.options.content);
  if (!subject || !content) throw new Error('Kit: subject and content are required');
  const body: Record<string, unknown> = { subject, content };
  const description = asString(ctx.options.description);
  if (description) body.description = description;
  const res = await apiRequest({
    service: 'Kit',
    method: 'POST',
    url: `${API}/v4/broadcasts`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { broadcast: res.data }, logs: [`Kit broadcast create → ${subject}`] };
}

const block: ForgeBlock = {
  id: 'forge_kit',
  name: 'Kit (ConvertKit)',
  description: 'Kit (formerly ConvertKit) — subscribers, tags and broadcasts.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'subscriber_create',
      label: 'Create subscriber',
      description: 'Add a subscriber.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'state', label: 'State', type: 'text', placeholder: 'active' },
      ],
      run: subscriberCreate,
    },
    {
      id: 'subscriber_list',
      label: 'List subscribers',
      description: 'List subscribers with status filter.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'status', label: 'Status', type: 'text' },
        { id: 'perPage', label: 'Per page', type: 'number' },
      ],
      run: subscriberList,
    },
    {
      id: 'tag_add',
      label: 'Add tag to subscriber',
      description: 'Tag a subscriber.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'tagId', label: 'Tag ID', type: 'text', required: true },
        { id: 'subscriberId', label: 'Subscriber ID', type: 'text', required: true },
      ],
      run: tagAdd,
    },
    {
      id: 'broadcast_create',
      label: 'Create broadcast',
      description: 'Draft a new broadcast email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'description', label: 'Description', type: 'text' },
      ],
      run: broadcastCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
