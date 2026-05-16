/**
 * Forge block: Syncro MSP
 *
 * Source: n8n-master/packages/nodes-base/nodes/SyncroMSP/SyncroMsp.node.ts
 * Credential type: 'syncro_msp' — fields: { subdomain, apiKey }
 *
 * Operations (subset):
 *   - ticket.create        POST /api/v1/tickets
 *   - ticket.get           GET  /api/v1/tickets/{id}
 *   - customer.list        GET  /api/v1/customers
 *
 * Deferred: contact, invoice, asset, RMM, pagination.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function getHeaders(ctx: ForgeActionContext): { base: string; headers: Record<string, string> } {
  const cred = requireCredential('Syncro MSP', ctx.credential);
  const subdomain = cred.subdomain;
  const apiKey = cred.apiKey;
  if (!subdomain) throw new Error('Syncro MSP: credential is missing `subdomain` field');
  if (!apiKey) throw new Error('Syncro MSP: credential is missing `apiKey` field');
  return {
    base: `https://${subdomain}.syncromsp.com`,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

async function syncroApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, headers } = getHeaders(ctx);
  const res = await apiRequest({
    service: 'Syncro MSP',
    method,
    url: `${base}${path}`,
    headers,
    json,
  });
  return res.data;
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error('Syncro MSP: extra fields must be a JSON object');
}

// ── Actions ────────────────────────────────────────────────────────────────

async function ticketCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customerId = asString(ctx.options.customerId);
  const subject = asString(ctx.options.subject);
  if (!customerId) throw new Error('Syncro MSP: customerId is required');
  if (!subject) throw new Error('Syncro MSP: subject is required');

  const body: Record<string, unknown> = {
    customer_id: Number(customerId),
    subject,
    ...parseJsonObject(ctx.options.extra),
  };
  const status = asString(ctx.options.status);
  const problemType = asString(ctx.options.problemType);
  if (status) body.status = status;
  if (problemType) body.problem_type = problemType;

  const data = (await syncroApi(ctx, 'POST', '/api/v1/tickets', body)) as
    | { ticket?: { id?: number } }
    | null;
  return {
    outputs: { ticket: data, id: data?.ticket?.id ?? null },
    logs: [`Syncro ticket create → ${data?.ticket?.id ?? '?'}`],
  };
}

async function ticketGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('Syncro MSP: ticketId is required');
  const data = await syncroApi(ctx, 'GET', `/api/v1/tickets/${encodeURIComponent(id)}`);
  return { outputs: { ticket: data }, logs: [`Syncro ticket get → ${id}`] };
}

async function customerList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const qs = new URLSearchParams();
  const page = asString(ctx.options.page);
  const query = asString(ctx.options.query);
  if (page) qs.set('page', page);
  if (query) qs.set('query', query);
  const path = qs.size ? `/api/v1/customers?${qs.toString()}` : '/api/v1/customers';
  const data = await syncroApi(ctx, 'GET', path);
  return { outputs: { result: data }, logs: ['Syncro customer list'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_syncro_msp',
  name: 'Syncro MSP',
  description: 'Manage Syncro MSP tickets and customers.',
  iconName: 'LuTicket',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'syncro_msp' },
  actions: [
    {
      id: 'ticket_create',
      label: 'Create ticket',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'number', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'status', label: 'Status', type: 'text' },
        { id: 'problemType', label: 'Problem type', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
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
      id: 'customer_list',
      label: 'List customers',
      fields: [
        { id: 'page', label: 'Page', type: 'number', defaultValue: 1 },
        { id: 'query', label: 'Search query', type: 'text' },
      ],
      run: customerList,
    },
  ],
};

registerForgeBlock(block);
export default block;
