/**
 * Forge block: Chargebee
 *
 * Source: n8n-master/packages/nodes-base/nodes/Chargebee/Chargebee.node.ts
 *   (base URL: https://{accountName}.chargebee.com/api/v2)
 * Credential type: 'chargebee' — expected fields:
 *   - accountName  (your Chargebee site, e.g. "acme" or "acme-test")
 *   - apiKey       (Chargebee API key)
 *
 * Auth: HTTP Basic with apiKey as username, empty password.
 * Body encoding: Chargebee expects application/x-www-form-urlencoded with
 * bracketed keys (e.g. `card[number]=…`).
 *
 * Operations covered:
 *   - customer.create      POST /customers
 *   - customer.get         GET  /customers/{id}
 *   - subscription.create  POST /customers/{id}/subscription_for_items
 *   - subscription.cancel  POST /subscriptions/{id}/cancel_for_items
 *   - invoice.list         GET  /invoices
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function b64(input: string): string {
  if (typeof btoa === 'function') return btoa(input);
  const g = globalThis as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } };
  if (g.Buffer) return g.Buffer.from(input).toString('base64');
  throw new Error('Chargebee: no base64 encoder available in this runtime');
}

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('Chargebee', ctx.credential);
  const account = asString(cred.accountName || cred.account || cred.site);
  if (!account) throw new Error('Chargebee: credential is missing `accountName`');
  return `https://${account}.chargebee.com/api/v2`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Chargebee', ctx.credential);
  const apiKey = asString(cred.apiKey);
  if (!apiKey) throw new Error('Chargebee: credential is missing `apiKey`');
  return { Authorization: `Basic ${b64(`${apiKey}:`)}` };
}

function encodeForm(input: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === '') continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        const sub = `${key}[${idx}]`;
        if (item !== null && typeof item === 'object') {
          out.push(...encodeForm(item as Record<string, unknown>, sub));
        } else {
          out.push(`${encodeURIComponent(sub)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof v === 'object') {
      out.push(...encodeForm(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

async function cbApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  path: string,
  form?: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = { ...authHeaders(ctx) };
  let url = `${baseUrl(ctx)}${path}`;
  let body: string | undefined;
  if (method === 'GET' && form && Object.keys(form).length > 0) {
    url += (url.includes('?') ? '&' : '?') + encodeForm(form).join('&');
  } else if (form && Object.keys(form).length > 0) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = encodeForm(form).join('&');
  }
  const res = await apiRequest({ service: 'Chargebee', method, url, headers, body });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function customerCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const form: Record<string, unknown> = {
    first_name: asString(ctx.options.firstName) || undefined,
    last_name: asString(ctx.options.lastName) || undefined,
    email: asString(ctx.options.email) || undefined,
    company: asString(ctx.options.company) || undefined,
    phone: asString(ctx.options.phone) || undefined,
  };
  const data = (await cbApi(ctx, 'POST', '/customers', form)) as { customer?: { id?: string } } | null;
  return {
    outputs: { customer: data?.customer ?? null, id: data?.customer?.id ?? null },
    logs: [`Chargebee customer create → ${data?.customer?.id ?? '?'}`],
  };
}

async function customerGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Chargebee: customerId is required');
  const data = (await cbApi(ctx, 'GET', `/customers/${encodeURIComponent(id)}`)) as { customer?: unknown } | null;
  return { outputs: { customer: data?.customer ?? null }, logs: [`Chargebee customer get → ${id}`] };
}

async function subscriptionCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customerId = asString(ctx.options.customerId);
  const itemPriceId = asString(ctx.options.itemPriceId);
  if (!customerId) throw new Error('Chargebee: customerId is required');
  if (!itemPriceId) throw new Error('Chargebee: itemPriceId is required');
  const quantity = asString(ctx.options.quantity);

  const form: Record<string, unknown> = {
    subscription_items: [
      { item_price_id: itemPriceId, quantity: quantity ? Number(quantity) : undefined },
    ],
  };
  const data = (await cbApi(
    ctx,
    'POST',
    `/customers/${encodeURIComponent(customerId)}/subscription_for_items`,
    form,
  )) as { subscription?: { id?: string } } | null;
  return {
    outputs: { subscription: data?.subscription ?? null, id: data?.subscription?.id ?? null },
    logs: [`Chargebee subscription create → ${data?.subscription?.id ?? '?'}`],
  };
}

async function subscriptionCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.subscriptionId);
  if (!id) throw new Error('Chargebee: subscriptionId is required');
  const endOfTerm = asString(ctx.options.endOfTerm);
  const form: Record<string, unknown> = {
    end_of_term: endOfTerm === 'true' ? true : undefined,
  };
  const data = (await cbApi(
    ctx,
    'POST',
    `/subscriptions/${encodeURIComponent(id)}/cancel_for_items`,
    form,
  )) as { subscription?: unknown } | null;
  return { outputs: { subscription: data?.subscription ?? null }, logs: [`Chargebee subscription cancel → ${id}`] };
}

async function invoiceList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit) || '20';
  const customerId = asString(ctx.options.customerId);
  const form: Record<string, unknown> = { limit };
  if (customerId) form['customer_id[is]'] = customerId;
  const data = (await cbApi(ctx, 'GET', '/invoices', form)) as { list?: unknown[] } | null;
  return {
    outputs: { invoices: data?.list ?? [] },
    logs: [`Chargebee invoice list → ${Array.isArray(data?.list) ? data!.list!.length : 0}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_chargebee',
  name: 'Chargebee',
  description: 'Manage Chargebee customers, subscriptions and invoices.',
  iconName: 'LuReceipt',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'chargebee',
  },
  actions: [
    {
      id: 'customer_create',
      label: 'Create customer',
      description: 'Create a Chargebee customer.',
      fields: [
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
      ],
      run: customerCreate,
    },
    {
      id: 'customer_get',
      label: 'Get customer',
      description: 'Fetch a customer by id.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
      ],
      run: customerGet,
    },
    {
      id: 'subscription_create',
      label: 'Create subscription',
      description: 'Create a subscription for a customer using an item price.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'itemPriceId', label: 'Item price ID', type: 'text', required: true },
        { id: 'quantity', label: 'Quantity', type: 'number', defaultValue: '1' },
      ],
      run: subscriptionCreate,
    },
    {
      id: 'subscription_cancel',
      label: 'Cancel subscription',
      description: 'Cancel a subscription immediately or at end of term.',
      fields: [
        { id: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
        {
          id: 'endOfTerm',
          label: 'When',
          type: 'select',
          defaultValue: 'false',
          options: [
            { label: 'Immediately', value: 'false' },
            { label: 'End of term', value: 'true' },
          ],
        },
      ],
      run: subscriptionCancel,
    },
    {
      id: 'invoice_list',
      label: 'List invoices',
      description: 'List invoices, optionally scoped to one customer.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: '20' },
      ],
      run: invoiceList,
    },
  ],
};

registerForgeBlock(block);
export default block;
