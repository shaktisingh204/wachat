/**
 * Forge block: Zammad
 *
 * Source: n8n-master/packages/nodes-base/nodes/Zammad/Zammad.node.ts
 * Credential type: 'zammad' → { baseUrl, accessToken }.
 *
 * Operations:
 *   - ticket.create     POST /api/v1/tickets
 *   - ticket.get        GET  /api/v1/tickets/{id}
 *   - ticket.list       GET  /api/v1/tickets
 *   - user.get          GET  /api/v1/users/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential, type HttpMethod } from '../_shared/http';

function zmAuth(ctx: ForgeActionContext): { base: string; token: string } {
  const cred = requireCredential('Zammad', ctx.credential);
  const base = (cred.baseUrl ?? '').replace(/\/+$/, '');
  const token = cred.accessToken ?? cred.apiKey ?? '';
  if (!base) throw new Error('Zammad: credential is missing `baseUrl`');
  if (!token) throw new Error('Zammad: credential is missing `accessToken`');
  return { base, token };
}

async function zmRequest(
  ctx: ForgeActionContext,
  method: HttpMethod,
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, token } = zmAuth(ctx);
  const res = await apiRequest({
    service: 'Zammad',
    method,
    url: `${base}${path.startsWith('/') ? path : `/${path}`}`,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    json,
  });
  return res.data;
}

async function ticketCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const groupId = asString(ctx.options.groupId);
  const customerId = asString(ctx.options.customerId);
  const articleBody = asString(ctx.options.articleBody);
  if (!title) throw new Error('Zammad: title is required');
  if (!groupId) throw new Error('Zammad: groupId is required');
  if (!customerId) throw new Error('Zammad: customerId is required');
  if (!articleBody) throw new Error('Zammad: articleBody is required');

  const body: Record<string, unknown> = {
    title,
    group_id: Number(groupId),
    customer_id: Number(customerId),
    article: {
      subject: title,
      body: articleBody,
      type: 'note',
      internal: false,
    },
  };
  const priority = asString(ctx.options.priorityId);
  const state = asString(ctx.options.stateId);
  if (priority) body.priority_id = Number(priority);
  if (state) body.state_id = Number(state);

  const data = await zmRequest(ctx, 'POST', '/api/v1/tickets', body);
  return { outputs: { ticket: data }, logs: [`Zammad ticket create → ${title}`] };
}

async function ticketGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('Zammad: ticketId is required');
  const data = await zmRequest(ctx, 'GET', `/api/v1/tickets/${id}`);
  return { outputs: { ticket: data }, logs: [`Zammad ticket get → ${id}`] };
}

async function ticketList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const page = asString(ctx.options.page);
  const perPage = asString(ctx.options.perPage);
  const qs = new URLSearchParams();
  if (page) qs.set('page', page);
  if (perPage) qs.set('per_page', perPage);
  const path = `/api/v1/tickets${qs.toString() ? `?${qs.toString()}` : ''}`;
  const data = await zmRequest(ctx, 'GET', path);
  return { outputs: { tickets: data }, logs: ['Zammad ticket list'] };
}

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('Zammad: userId is required');
  const data = await zmRequest(ctx, 'GET', `/api/v1/users/${id}`);
  return { outputs: { user: data }, logs: [`Zammad user get → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_zammad',
  name: 'Zammad',
  description: 'Create and inspect Zammad tickets and users.',
  iconName: 'LuTicket',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'zammad' },
  actions: [
    {
      id: 'ticket_create',
      label: 'Create ticket',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'groupId', label: 'Group ID', type: 'text', required: true },
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'articleBody', label: 'First article body', type: 'textarea', required: true },
        { id: 'priorityId', label: 'Priority ID', type: 'text' },
        { id: 'stateId', label: 'State ID', type: 'text' },
      ],
      run: ticketCreate,
    },
    {
      id: 'ticket_get',
      label: 'Get ticket',
      fields: [{ id: 'ticketId', label: 'Ticket ID', type: 'text', required: true }],
      run: ticketGet,
    },
    {
      id: 'ticket_list',
      label: 'List tickets',
      fields: [
        { id: 'page', label: 'Page', type: 'number' },
        { id: 'perPage', label: 'Per page', type: 'number' },
      ],
      run: ticketList,
    },
    {
      id: 'user_get',
      label: 'Get user',
      fields: [{ id: 'userId', label: 'User ID', type: 'text', required: true }],
      run: userGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
