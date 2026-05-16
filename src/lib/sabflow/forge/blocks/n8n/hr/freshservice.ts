/**
 * Forge block: Freshservice
 *
 * Source: n8n-master/packages/nodes-base/nodes/Freshservice/Freshservice.node.ts
 *
 * Auth: Basic (apiKey:x) on `{domain}/api/v2`.
 *
 * Operations covered:
 *   - ticket.create   POST /tickets
 *   - ticket.get      GET  /tickets/{id}
 *   - ticket.list     GET  /tickets
 *   - agent.list      GET  /agents
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const domain = asString(ctx.options.domain).replace(/\/$/, '');
  if (!domain) throw new Error('Freshservice: domain is required');
  return /^https?:\/\//.test(domain) ? `${domain}/api/v2` : `https://${domain}/api/v2`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Freshservice: apiKey is required');
  return {
    Authorization: `Basic ${btoa(`${apiKey}:x`)}`,
    Accept: 'application/json',
  };
}

async function ticketCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const description = asString(ctx.options.description);
  const email = asString(ctx.options.email);
  if (!subject || !description || !email) {
    throw new Error('Freshservice: subject, description and email are required');
  }
  const body: Record<string, unknown> = {
    subject,
    description,
    email,
    status: Number(asString(ctx.options.status) || '2'),
    priority: Number(asString(ctx.options.priority) || '1'),
  };
  const res = await apiRequest({
    service: 'Freshservice',
    method: 'POST',
    url: `${baseUrl(ctx)}/tickets`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { ticket: res.data }, logs: [`Freshservice ticket create → ${subject}`] };
}

async function ticketGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('Freshservice: ticketId is required');
  const res = await apiRequest({
    service: 'Freshservice',
    method: 'GET',
    url: `${baseUrl(ctx)}/tickets/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { ticket: res.data }, logs: [`Freshservice ticket get → ${id}`] };
}

async function ticketList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const perPage = asString(ctx.options.perPage);
  const page = asString(ctx.options.page);
  if (perPage) params.set('per_page', perPage);
  if (page) params.set('page', page);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Freshservice',
    method: 'GET',
    url: `${baseUrl(ctx)}/tickets${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { tickets: res.data }, logs: ['Freshservice ticket list'] };
}

async function agentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Freshservice',
    method: 'GET',
    url: `${baseUrl(ctx)}/agents`,
    headers: authHeaders(ctx),
  });
  return { outputs: { agents: res.data }, logs: ['Freshservice agent list'] };
}

const block: ForgeBlock = {
  id: 'forge_freshservice',
  name: 'Freshservice',
  description: 'Manage Freshservice tickets and agents.',
  iconName: 'LuLifeBuoy',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'ticket_create',
      label: 'Create ticket',
      description: 'Create a new ticket.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'acme.freshservice.com' },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'text', required: true },
        { id: 'email', label: 'Requester email', type: 'text', required: true },
        { id: 'status', label: 'Status (2=open)', type: 'number' },
        { id: 'priority', label: 'Priority (1-4)', type: 'number' },
      ],
      run: ticketCreate,
    },
    {
      id: 'ticket_get',
      label: 'Get ticket',
      description: 'Fetch a ticket by id.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'ticketId', label: 'Ticket ID', type: 'text', required: true },
      ],
      run: ticketGet,
    },
    {
      id: 'ticket_list',
      label: 'List tickets',
      description: 'List tickets with optional pagination.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'perPage', label: 'Per page', type: 'number' },
        { id: 'page', label: 'Page', type: 'number' },
      ],
      run: ticketList,
    },
    {
      id: 'agent_list',
      label: 'List agents',
      description: 'Fetch all agents.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: agentList,
    },
  ],
};

registerForgeBlock(block);
export default block;
