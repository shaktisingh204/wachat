/**
 * Forge block: Invoice Ninja
 *
 * Source: n8n-master/packages/nodes-base/nodes/InvoiceNinja/InvoiceNinja.node.ts
 *   (+ GenericFunctions.ts — v4 default: https://app.invoiceninja.com,
 *      v5 default: https://invoicing.co, path: /api/v1)
 * Credential type: 'invoiceninja' — expected fields:
 *   - url      (optional self-hosted base url; falls back to v5 default)
 *   - apiToken (X-Api-Token header)
 *   - version  (optional "v4" or "v5", default "v5")
 *
 * Operations covered:
 *   - client.create   POST /clients
 *   - client.get      GET  /clients/{id}
 *   - invoice.create  POST /invoices
 *   - invoice.get     GET  /invoices/{id}
 *   - invoice.email   GET  /email_invoice?id={id}  (v4)
 *                     or POST /invoices/{id}/email (v5)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function inferVersion(ctx: ForgeActionContext): 'v4' | 'v5' {
  const cred = requireCredential('InvoiceNinja', ctx.credential);
  const v = asString(cred.version).toLowerCase();
  return v === 'v4' ? 'v4' : 'v5';
}

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('InvoiceNinja', ctx.credential);
  const version = inferVersion(ctx);
  const defaultUrl = version === 'v4' ? 'https://app.invoiceninja.com' : 'https://invoicing.co';
  let url = asString(cred.url) || defaultUrl;
  url = url.replace(/\/+$/, '');
  return `${url}/api/v1`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('InvoiceNinja', ctx.credential);
  const token = asString(cred.apiToken || cred.accessToken || cred.apiKey);
  if (!token) throw new Error('InvoiceNinja: credential is missing `apiToken`');
  return { 'X-Api-Token': token, Accept: 'application/json' };
}

async function inApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'InvoiceNinja',
    method,
    url: `${baseUrl(ctx)}${path}`,
    headers: authHeaders(ctx),
    json,
  });
  return res.data;
}

function parseJsonObject(raw: unknown, label: string): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`InvoiceNinja: ${label} must be a JSON object`);
}

function parseJsonArray(raw: unknown, label: string): unknown[] {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v;
  } catch {
    /* ignore */
  }
  throw new Error(`InvoiceNinja: ${label} must be a JSON array`);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function clientCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('InvoiceNinja: name is required');
  const body: Record<string, unknown> = {
    name,
    email: asString(ctx.options.email) || undefined,
    phone: asString(ctx.options.phone) || undefined,
    website: asString(ctx.options.website) || undefined,
  };
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(body, extra);

  const data = (await inApi(ctx, 'POST', '/clients', body)) as { data?: { id?: string } } | null;
  return {
    outputs: { client: data?.data ?? data, id: data?.data?.id ?? null },
    logs: [`InvoiceNinja client create → ${data?.data?.id ?? '?'}`],
  };
}

async function clientGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.clientId);
  if (!id) throw new Error('InvoiceNinja: clientId is required');
  const data = (await inApi(ctx, 'GET', `/clients/${encodeURIComponent(id)}`)) as { data?: unknown } | null;
  return { outputs: { client: data?.data ?? data }, logs: [`InvoiceNinja client get → ${id}`] };
}

async function invoiceCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const clientId = asString(ctx.options.clientId);
  if (!clientId) throw new Error('InvoiceNinja: clientId is required');
  const lineItems = parseJsonArray(ctx.options.lineItems, 'lineItems');
  if (lineItems.length === 0) {
    throw new Error('InvoiceNinja: lineItems must contain at least one line item');
  }

  const body: Record<string, unknown> = {
    client_id: clientId,
    line_items: lineItems,
    invoice_number: asString(ctx.options.invoiceNumber) || undefined,
    po_number: asString(ctx.options.poNumber) || undefined,
    date: asString(ctx.options.date) || undefined,
    due_date: asString(ctx.options.dueDate) || undefined,
  };
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(body, extra);

  const data = (await inApi(ctx, 'POST', '/invoices', body)) as { data?: { id?: string } } | null;
  return {
    outputs: { invoice: data?.data ?? data, id: data?.data?.id ?? null },
    logs: [`InvoiceNinja invoice create → ${data?.data?.id ?? '?'}`],
  };
}

async function invoiceGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.invoiceId);
  if (!id) throw new Error('InvoiceNinja: invoiceId is required');
  const data = (await inApi(ctx, 'GET', `/invoices/${encodeURIComponent(id)}`)) as { data?: unknown } | null;
  return { outputs: { invoice: data?.data ?? data }, logs: [`InvoiceNinja invoice get → ${id}`] };
}

async function invoiceEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.invoiceId);
  if (!id) throw new Error('InvoiceNinja: invoiceId is required');
  if (inferVersion(ctx) === 'v4') {
    const data = await inApi(ctx, 'GET', `/email_invoice?id=${encodeURIComponent(id)}`);
    return { outputs: { result: data }, logs: [`InvoiceNinja invoice email (v4) → ${id}`] };
  }
  const data = await inApi(ctx, 'POST', `/invoices/${encodeURIComponent(id)}/email`, {});
  return { outputs: { result: data }, logs: [`InvoiceNinja invoice email (v5) → ${id}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_invoiceninja',
  name: 'Invoice Ninja',
  description: 'Manage Invoice Ninja clients and invoices (v4 + v5).',
  iconName: 'LuReceipt',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'invoiceninja',
  },
  actions: [
    {
      id: 'client_create',
      label: 'Create client',
      description: 'Create a client.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'extra', label: 'Extra client JSON (advanced)', type: 'json' },
      ],
      run: clientCreate,
    },
    {
      id: 'client_get',
      label: 'Get client',
      description: 'Fetch a client by id.',
      fields: [
        { id: 'clientId', label: 'Client ID', type: 'text', required: true },
      ],
      run: clientGet,
    },
    {
      id: 'invoice_create',
      label: 'Create invoice',
      description: 'Create an invoice for a client.',
      fields: [
        { id: 'clientId', label: 'Client ID', type: 'text', required: true },
        {
          id: 'lineItems',
          label: 'Line items (JSON array)',
          type: 'json',
          required: true,
          helperText: 'e.g. [{"product_key":"Item","quantity":1,"cost":10}]',
        },
        { id: 'invoiceNumber', label: 'Invoice number', type: 'text' },
        { id: 'poNumber', label: 'PO number', type: 'text' },
        { id: 'date', label: 'Date (YYYY-MM-DD)', type: 'text' },
        { id: 'dueDate', label: 'Due date (YYYY-MM-DD)', type: 'text' },
        { id: 'extra', label: 'Extra invoice JSON (advanced)', type: 'json' },
      ],
      run: invoiceCreate,
    },
    {
      id: 'invoice_get',
      label: 'Get invoice',
      description: 'Fetch an invoice by id.',
      fields: [
        { id: 'invoiceId', label: 'Invoice ID', type: 'text', required: true },
      ],
      run: invoiceGet,
    },
    {
      id: 'invoice_email',
      label: 'Email invoice',
      description: 'Email an invoice to its client.',
      fields: [
        { id: 'invoiceId', label: 'Invoice ID', type: 'text', required: true },
      ],
      run: invoiceEmail,
    },
  ],
};

registerForgeBlock(block);
export default block;
