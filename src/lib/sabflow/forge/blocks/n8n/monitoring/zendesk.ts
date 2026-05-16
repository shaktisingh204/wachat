/**
 * Forge block: Zendesk
 *
 * Source: n8n-master/packages/nodes-base/nodes/Zendesk/Zendesk.node.ts
 * Credential type: 'zendesk' → { subdomain, email, apiToken }.
 *
 * Basic auth with `${email}/token:${apiToken}`.
 *
 * Operations:
 *   - ticket.create     POST   /api/v2/tickets.json
 *   - ticket.get        GET    /api/v2/tickets/{id}.json
 *   - ticket.list       GET    /api/v2/tickets.json
 *   - ticket.update     PUT    /api/v2/tickets/{id}.json
 *   - ticket.delete     DELETE /api/v2/tickets/{id}.json
 *   - user.get          GET    /api/v2/users/{id}.json
 *   - user.create       POST   /api/v2/users.json
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential, type HttpMethod } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

function zdAuth(ctx: ForgeActionContext): { base: string; auth: string } {
  const cred = requireCredential('Zendesk', ctx.credential);
  const subdomain = cred.subdomain ?? '';
  const email = cred.email ?? '';
  const apiToken = cred.apiToken ?? '';
  if (!subdomain) throw new Error('Zendesk: credential is missing `subdomain`');
  if (!email || !apiToken) throw new Error('Zendesk: credential needs email + apiToken');
  const auth = `Basic ${btoa(`${email}/token:${apiToken}`)}`;
  return { base: `https://${subdomain}.zendesk.com`, auth };
}

async function zdRequest(
  ctx: ForgeActionContext,
  method: HttpMethod,
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, auth } = zdAuth(ctx);
  const res = await apiRequest({
    service: 'Zendesk',
    method,
    url: `${base}${path.startsWith('/') ? path : `/${path}`}`,
    headers: { Authorization: auth, Accept: 'application/json' },
    json,
  });
  return res.data;
}

async function ticketCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const description = asString(ctx.options.description);
  if (!subject) throw new Error('Zendesk: subject is required');
  if (!description) throw new Error('Zendesk: description is required');

  const ticket: Record<string, unknown> = {
    subject,
    comment: { body: description },
  };
  const priority = asString(ctx.options.priority);
  const status = asString(ctx.options.status);
  const type = asString(ctx.options.type);
  const requesterEmail = asString(ctx.options.requesterEmail);
  if (priority) ticket.priority = priority;
  if (status) ticket.status = status;
  if (type) ticket.type = type;
  if (requesterEmail) ticket.requester = { email: requesterEmail };

  const data = await zdRequest(ctx, 'POST', '/api/v2/tickets.json', { ticket });
  return { outputs: { ticket: (data as { ticket?: unknown }).ticket }, logs: [`Zendesk ticket create → ${subject}`] };
}

async function ticketGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('Zendesk: ticketId is required');
  const data = await zdRequest(ctx, 'GET', `/api/v2/tickets/${id}.json`);
  return { outputs: { ticket: (data as { ticket?: unknown }).ticket }, logs: [`Zendesk ticket get → ${id}`] };
}

async function ticketList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const perPage = asString(ctx.options.perPage);
  const path = perPage ? `/api/v2/tickets.json?per_page=${perPage}` : '/api/v2/tickets.json';
  const data = await zdRequest(ctx, 'GET', path);
  return { outputs: { tickets: (data as { tickets?: unknown }).tickets }, logs: ['Zendesk ticket list'] };
}

async function ticketListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { base, auth } = zdAuth(ctx);
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const firstUrl = `${base}/api/v2/tickets.json?page%5Bsize%5D=${encodeURIComponent(pageSize)}`;

  const tickets = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      // Zendesk cursor pagination returns `links.next` as a full URL — follow
      // it verbatim, like the Shopify pattern.
      const url = cursor ?? firstUrl;
      const res = await apiRequest({
        service: 'Zendesk',
        method: 'GET',
        url,
        headers: { Authorization: auth, Accept: 'application/json' },
      });
      const body = res.data as {
        tickets?: unknown[];
        meta?: { has_more?: boolean; after_cursor?: string };
        links?: { next?: string };
      } | null;
      const items = (body?.tickets ?? []) as unknown[];
      const nextCursor = body?.meta?.has_more ? body.links?.next : undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { tickets, count: tickets.length },
    logs: [`Zendesk ticket list all → ${tickets.length}`],
  };
}

async function ticketUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('Zendesk: ticketId is required');

  const ticket: Record<string, unknown> = {};
  const subject = asString(ctx.options.subject);
  const status = asString(ctx.options.status);
  const priority = asString(ctx.options.priority);
  const comment = asString(ctx.options.comment);
  if (subject) ticket.subject = subject;
  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;
  if (comment) ticket.comment = { body: comment };
  if (Object.keys(ticket).length === 0) {
    throw new Error('Zendesk: at least one updatable field must be set');
  }

  const data = await zdRequest(ctx, 'PUT', `/api/v2/tickets/${id}.json`, { ticket });
  return { outputs: { ticket: (data as { ticket?: unknown }).ticket }, logs: [`Zendesk ticket update → ${id}`] };
}

async function ticketDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('Zendesk: ticketId is required');
  await zdRequest(ctx, 'DELETE', `/api/v2/tickets/${id}.json`);
  return { outputs: { success: true }, logs: [`Zendesk ticket delete → ${id}`] };
}

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('Zendesk: userId is required');
  const data = await zdRequest(ctx, 'GET', `/api/v2/users/${id}.json`);
  return { outputs: { user: (data as { user?: unknown }).user }, logs: [`Zendesk user get → ${id}`] };
}

async function userCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const email = asString(ctx.options.email);
  if (!name) throw new Error('Zendesk: name is required');
  if (!email) throw new Error('Zendesk: email is required');

  const user: Record<string, unknown> = { name, email };
  const role = asString(ctx.options.role);
  if (role) user.role = role;

  const data = await zdRequest(ctx, 'POST', '/api/v2/users.json', { user });
  return { outputs: { user: (data as { user?: unknown }).user }, logs: [`Zendesk user create → ${email}`] };
}

const block: ForgeBlock = {
  id: 'forge_zendesk',
  name: 'Zendesk',
  description: 'Manage Zendesk tickets and users from a flow.',
  iconName: 'LuHeadphones',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'zendesk' },
  actions: [
    {
      id: 'ticket_create',
      label: 'Create ticket',
      fields: [
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea', required: true },
        { id: 'requesterEmail', label: 'Requester email', type: 'text' },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { label: 'None', value: '' },
            { label: 'Low', value: 'low' },
            { label: 'Normal', value: 'normal' },
            { label: 'High', value: 'high' },
            { label: 'Urgent', value: 'urgent' },
          ],
        },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'None', value: '' },
            { label: 'New', value: 'new' },
            { label: 'Open', value: 'open' },
            { label: 'Pending', value: 'pending' },
            { label: 'Hold', value: 'hold' },
            { label: 'Solved', value: 'solved' },
            { label: 'Closed', value: 'closed' },
          ],
        },
        {
          id: 'type',
          label: 'Type',
          type: 'select',
          options: [
            { label: 'None', value: '' },
            { label: 'Problem', value: 'problem' },
            { label: 'Incident', value: 'incident' },
            { label: 'Question', value: 'question' },
            { label: 'Task', value: 'task' },
          ],
        },
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
      fields: [{ id: 'perPage', label: 'Per page', type: 'number', placeholder: '100' }],
      run: ticketList,
    },
    {
      id: 'ticket_list_all',
      label: 'List all tickets (paginated)',
      description: 'Walk Zendesk\'s cursor pagination (`links.next`) and return every ticket up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
      ],
      run: ticketListAll,
    },
    {
      id: 'ticket_update',
      label: 'Update ticket',
      fields: [
        { id: 'ticketId', label: 'Ticket ID', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'comment', label: 'Add comment', type: 'textarea' },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'New', value: 'new' },
            { label: 'Open', value: 'open' },
            { label: 'Pending', value: 'pending' },
            { label: 'Hold', value: 'hold' },
            { label: 'Solved', value: 'solved' },
            { label: 'Closed', value: 'closed' },
          ],
        },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'Low', value: 'low' },
            { label: 'Normal', value: 'normal' },
            { label: 'High', value: 'high' },
            { label: 'Urgent', value: 'urgent' },
          ],
        },
      ],
      run: ticketUpdate,
    },
    {
      id: 'ticket_delete',
      label: 'Delete ticket',
      fields: [{ id: 'ticketId', label: 'Ticket ID', type: 'text', required: true }],
      run: ticketDelete,
    },
    {
      id: 'user_get',
      label: 'Get user',
      fields: [{ id: 'userId', label: 'User ID', type: 'text', required: true }],
      run: userGet,
    },
    {
      id: 'user_create',
      label: 'Create user',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        {
          id: 'role',
          label: 'Role',
          type: 'select',
          options: [
            { label: 'End user', value: 'end-user' },
            { label: 'Agent', value: 'agent' },
            { label: 'Admin', value: 'admin' },
          ],
        },
      ],
      run: userCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
