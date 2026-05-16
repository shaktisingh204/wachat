/**
 * Forge block: HaloPSA
 *
 * Source: n8n-master/packages/nodes-base/nodes/HaloPSA/HaloPSA.node.ts
 *
 * Auth: Bearer accessToken on a tenant URL.
 *
 * Operations covered:
 *   - ticket.create   POST /api/Tickets
 *   - ticket.get      GET  /api/Tickets/{id}
 *   - ticket.list     GET  /api/Tickets
 *   - client.list     GET  /api/Client
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const tenant = asString(ctx.options.tenantUrl).replace(/\/$/, '');
  if (!tenant) throw new Error('HaloPSA: tenantUrl is required');
  return /^https?:\/\//.test(tenant) ? tenant : `https://${tenant}`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('HaloPSA: accessToken is required');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function ticketCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const summary = asString(ctx.options.summary);
  if (!summary) throw new Error('HaloPSA: summary is required');
  const body: Record<string, unknown> = { summary };
  const details = asString(ctx.options.details);
  const clientId = asString(ctx.options.clientId);
  const tickettype = asString(ctx.options.ticketTypeId);
  if (details) body.details = details;
  if (clientId) body.client_id = Number(clientId);
  if (tickettype) body.tickettype_id = Number(tickettype);
  const res = await apiRequest({
    service: 'HaloPSA',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/Tickets`,
    headers: authHeaders(ctx),
    json: [body],
  });
  return { outputs: { ticket: res.data }, logs: [`HaloPSA ticket create → ${summary}`] };
}

async function ticketGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('HaloPSA: ticketId is required');
  const res = await apiRequest({
    service: 'HaloPSA',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/Tickets/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { ticket: res.data }, logs: [`HaloPSA ticket get → ${id}`] };
}

async function ticketList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const pageSize = asString(ctx.options.pageSize);
  const pageNo = asString(ctx.options.pageNo);
  if (pageSize) params.set('page_size', pageSize);
  if (pageNo) params.set('page_no', pageNo);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'HaloPSA',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/Tickets${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { tickets: res.data }, logs: ['HaloPSA ticket list'] };
}

async function clientList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'HaloPSA',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/Client`,
    headers: authHeaders(ctx),
  });
  return { outputs: { clients: res.data }, logs: ['HaloPSA client list'] };
}

const block: ForgeBlock = {
  id: 'forge_halopsa',
  name: 'HaloPSA',
  description: 'Manage HaloPSA tickets and clients.',
  iconName: 'LuLifeBuoy',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'ticket_create',
      label: 'Create ticket',
      description: 'Create a new HaloPSA ticket.',
      fields: [
        { id: 'tenantUrl', label: 'Tenant URL', type: 'text', required: true, placeholder: 'https://acme.halopsa.com' },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'summary', label: 'Summary', type: 'text', required: true },
        { id: 'details', label: 'Details', type: 'text' },
        { id: 'clientId', label: 'Client ID', type: 'number' },
        { id: 'ticketTypeId', label: 'Ticket type ID', type: 'number' },
      ],
      run: ticketCreate,
    },
    {
      id: 'ticket_get',
      label: 'Get ticket',
      description: 'Fetch a ticket by id.',
      fields: [
        { id: 'tenantUrl', label: 'Tenant URL', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'ticketId', label: 'Ticket ID', type: 'text', required: true },
      ],
      run: ticketGet,
    },
    {
      id: 'ticket_list',
      label: 'List tickets',
      description: 'List tickets with optional pagination.',
      fields: [
        { id: 'tenantUrl', label: 'Tenant URL', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'pageSize', label: 'Page size', type: 'number' },
        { id: 'pageNo', label: 'Page number', type: 'number' },
      ],
      run: ticketList,
    },
    {
      id: 'client_list',
      label: 'List clients',
      description: 'Fetch all clients.',
      fields: [
        { id: 'tenantUrl', label: 'Tenant URL', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
      ],
      run: clientList,
    },
  ],
};

registerForgeBlock(block);
export default block;
