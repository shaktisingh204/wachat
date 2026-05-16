/**
 * Forge block: Buttondown
 *
 * API: https://docs.buttondown.email/api-introduction
 * Auth: `Authorization: Token <api_key>`.
 *
 * Operations covered:
 *   - subscriber.create         POST   /v1/subscribers
 *   - subscriber.list           GET    /v1/subscribers
 *   - subscriber.get            GET    /v1/subscribers/{id}
 *   - email.send                POST   /v1/emails
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.buttondown.email';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Buttondown: apiKey is required');
  return { Authorization: `Token ${key}` };
}

async function subscriberCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Buttondown: email is required');
  const body: Record<string, unknown> = { email_address: email };
  const notes = asString(ctx.options.notes);
  const tags = asString(ctx.options.tags);
  if (notes) body.notes = notes;
  if (tags) body.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const res = await apiRequest({
    service: 'Buttondown',
    method: 'POST',
    url: `${API}/v1/subscribers`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { subscriber: res.data }, logs: [`Buttondown subscriber create → ${email}`] };
}

async function subscriberList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const type = asString(ctx.options.type);
  const page = asString(ctx.options.page);
  if (type) params.set('type', type);
  if (page) params.set('page', page);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Buttondown',
    method: 'GET',
    url: `${API}/v1/subscribers${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { subscribers: res.data }, logs: ['Buttondown subscriber list'] };
}

async function subscriberGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.subscriberId);
  if (!id) throw new Error('Buttondown: subscriberId is required');
  const res = await apiRequest({
    service: 'Buttondown',
    method: 'GET',
    url: `${API}/v1/subscribers/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { subscriber: res.data }, logs: [`Buttondown subscriber get → ${id}`] };
}

async function emailSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const body = asString(ctx.options.body);
  if (!subject || !body) throw new Error('Buttondown: subject and body are required');
  const payload: Record<string, unknown> = { subject, body };
  const status = asString(ctx.options.status);
  if (status) payload.status = status;
  const res = await apiRequest({
    service: 'Buttondown',
    method: 'POST',
    url: `${API}/v1/emails`,
    headers: authHeader(ctx),
    json: payload,
  });
  return { outputs: { email: res.data }, logs: [`Buttondown email send → ${subject}`] };
}

const block: ForgeBlock = {
  id: 'forge_buttondown',
  name: 'Buttondown',
  description: 'Buttondown newsletter — subscribers + emails.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'subscriber_create',
      label: 'Create subscriber',
      description: 'Add or upsert a subscriber.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'notes', label: 'Notes', type: 'textarea' },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text' },
      ],
      run: subscriberCreate,
    },
    {
      id: 'subscriber_list',
      label: 'List subscribers',
      description: 'List subscribers with optional type filter.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'type', label: 'Type', type: 'text', placeholder: 'regular' },
        { id: 'page', label: 'Page', type: 'number' },
      ],
      run: subscriberList,
    },
    {
      id: 'subscriber_get',
      label: 'Get subscriber',
      description: 'Fetch a subscriber by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'subscriberId', label: 'Subscriber ID', type: 'text', required: true },
      ],
      run: subscriberGet,
    },
    {
      id: 'email_send',
      label: 'Send email',
      description: 'Create and send a Buttondown email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'body', label: 'Body (markdown)', type: 'textarea', required: true },
        { id: 'status', label: 'Status', type: 'text', placeholder: 'about_to_send' },
      ],
      run: emailSend,
    },
  ],
};

registerForgeBlock(block);
export default block;
