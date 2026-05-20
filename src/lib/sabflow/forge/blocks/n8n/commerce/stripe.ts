/**
 * Forge block: Stripe
 *
 * Source: n8n-master/packages/nodes-base/nodes/Stripe/Stripe.node.ts
 *   (+ helpers.ts: `https://api.stripe.com/v1${endpoint}`)
 * Credential type: 'stripe' — expected fields:
 *   - secretKey  (sk_live_… or sk_test_…)
 *
 * Auth: HTTP Basic with the secret key as the username, empty password.
 *
 * Body encoding: Stripe natively accepts application/x-www-form-urlencoded
 * with bracketed-key paths (e.g. `metadata[order_id]=42`). We use that for
 * compatibility across all API versions.
 *
 * Operations covered:
 *   - charge.create        POST /charges
 *   - customer.create      POST /customers
 *   - customer.get         GET  /customers/{id}
 *   - subscription.create  POST /subscriptions
 *   - subscription.cancel  DELETE /subscriptions/{id}
 *   - refund.create        POST /refunds
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';
import type { ForgeHttpRequest, ForgeHttpResponse } from '../../../helpers';

const BASE = 'https://api.stripe.com/v1';

/** Flatten a nested object into Stripe's bracketed form-encoded key paths. */
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

/** Stripe uses HTTP Basic with the secretKey as the username and an empty
 *  password (`sk_xxx:`); handled by `basic-custom` with no passField. */
async function stripeReq(
  ctx: ForgeActionContext,
  req: Omit<ForgeHttpRequest, 'userField'>,
): Promise<ForgeHttpResponse> {
  requireCredential('Stripe', ctx.credential);
  const r = await ctx.helpers!.requestWithAuthentication('basic-custom', {
    ...req,
    userField: 'secretKey',
  });
  if (!r.ok) {
    const text =
      typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? null);
    const clip = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`Stripe ${req.method} ${req.url} failed (${r.status}): ${clip}`);
  }
  return r;
}

async function stripeApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  form?: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (form && Object.keys(form).length > 0) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = encodeForm(form).join('&');
  }
  const res = await stripeReq(ctx, { method, url: `${BASE}${path}`, headers, body });
  return res.data;
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error('Stripe: metadata must be a JSON object');
}

// ── Actions ────────────────────────────────────────────────────────────────

async function chargeCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const amount = asString(ctx.options.amount);
  const currency = asString(ctx.options.currency);
  const source = asString(ctx.options.source);
  const customer = asString(ctx.options.customer);
  if (!amount) throw new Error('Stripe: amount is required (in the smallest currency unit)');
  if (!currency) throw new Error('Stripe: currency is required');
  if (!source && !customer) throw new Error('Stripe: either source or customer is required');

  const form: Record<string, unknown> = {
    amount: Number(amount),
    currency: currency.toLowerCase(),
    description: asString(ctx.options.description) || undefined,
    source: source || undefined,
    customer: customer || undefined,
    metadata: parseMetadata(ctx.options.metadata),
  };
  const data = (await stripeApi(ctx, 'POST', '/charges', form)) as { id?: string } | null;
  return { outputs: { charge: data, id: data?.id ?? null }, logs: [`Stripe charge create → ${data?.id ?? '?'}`] };
}

async function customerCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const form: Record<string, unknown> = {
    email: email || undefined,
    name: asString(ctx.options.name) || undefined,
    description: asString(ctx.options.description) || undefined,
    phone: asString(ctx.options.phone) || undefined,
    metadata: parseMetadata(ctx.options.metadata),
  };
  const data = (await stripeApi(ctx, 'POST', '/customers', form)) as { id?: string } | null;
  return { outputs: { customer: data, id: data?.id ?? null }, logs: [`Stripe customer create → ${data?.id ?? '?'}`] };
}

async function customerGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Stripe: customerId is required');
  const data = await stripeApi(ctx, 'GET', `/customers/${encodeURIComponent(id)}`);
  return { outputs: { customer: data }, logs: [`Stripe customer get → ${id}`] };
}

async function customerListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const email = asString(ctx.options.email);

  const customers = await paginateAll<{ id?: string }>({
    maxItems,
    async fetchPage(cursor) {
      const qs = new URLSearchParams();
      qs.set('limit', pageSize);
      if (cursor) qs.set('starting_after', cursor);
      if (email) qs.set('email', email);
      const res = await stripeReq(ctx, {
        method: 'GET',
        url: `${BASE}/customers?${qs.toString()}`,
      });
      const body = res.data as { data?: Array<{ id?: string }>; has_more?: boolean } | null;
      const items = (body?.data ?? []) as Array<{ id?: string }>;
      const last = items.length > 0 ? items[items.length - 1] : undefined;
      const nextCursor = body?.has_more && last?.id ? last.id : undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { customers, count: customers.length },
    logs: [`Stripe customer list all → ${customers.length}`],
  };
}

async function subscriptionCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customer = asString(ctx.options.customer);
  const priceId = asString(ctx.options.priceId);
  if (!customer) throw new Error('Stripe: customer is required');
  if (!priceId) throw new Error('Stripe: priceId is required');

  const form: Record<string, unknown> = {
    customer,
    items: [{ price: priceId }],
    metadata: parseMetadata(ctx.options.metadata),
  };
  const data = (await stripeApi(ctx, 'POST', '/subscriptions', form)) as { id?: string } | null;
  return {
    outputs: { subscription: data, id: data?.id ?? null },
    logs: [`Stripe subscription create → ${data?.id ?? '?'}`],
  };
}

async function subscriptionCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.subscriptionId);
  if (!id) throw new Error('Stripe: subscriptionId is required');
  const data = await stripeApi(ctx, 'DELETE', `/subscriptions/${encodeURIComponent(id)}`);
  return { outputs: { subscription: data }, logs: [`Stripe subscription cancel → ${id}`] };
}

async function refundCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const charge = asString(ctx.options.charge);
  const paymentIntent = asString(ctx.options.paymentIntent);
  if (!charge && !paymentIntent) {
    throw new Error('Stripe: either charge or paymentIntent is required');
  }
  const amount = asString(ctx.options.amount);
  const form: Record<string, unknown> = {
    charge: charge || undefined,
    payment_intent: paymentIntent || undefined,
    amount: amount ? Number(amount) : undefined,
    reason: asString(ctx.options.reason) || undefined,
    metadata: parseMetadata(ctx.options.metadata),
  };
  const data = (await stripeApi(ctx, 'POST', '/refunds', form)) as { id?: string } | null;
  return { outputs: { refund: data, id: data?.id ?? null }, logs: [`Stripe refund create → ${data?.id ?? '?'}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_stripe',
  name: 'Stripe',
  description: 'Charge customers and manage Stripe customers, subscriptions and refunds.',
  iconName: 'LuCreditCard',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'stripe',
  },
  actions: [
    {
      id: 'charge_create',
      label: 'Create charge',
      description: 'Create a one-off charge.',
      fields: [
        { id: 'amount', label: 'Amount (smallest unit, e.g. cents)', type: 'number', required: true },
        { id: 'currency', label: 'Currency (ISO 4217)', type: 'text', required: true, placeholder: 'usd' },
        { id: 'customer', label: 'Customer ID', type: 'text' },
        { id: 'source', label: 'Source / token', type: 'text' },
        { id: 'description', label: 'Description', type: 'text' },
        { id: 'metadata', label: 'Metadata JSON', type: 'json' },
      ],
      run: chargeCreate,
    },
    {
      id: 'customer_create',
      label: 'Create customer',
      description: 'Create a new Stripe customer.',
      fields: [
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'description', label: 'Description', type: 'text' },
        { id: 'metadata', label: 'Metadata JSON', type: 'json' },
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
      id: 'customer_list_all',
      label: 'List all customers (paginated)',
      description: 'Walk Stripe\'s `has_more` + `starting_after` pagination and return every customer up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
        { id: 'email', label: 'Filter by email (optional)', type: 'text' },
      ],
      run: customerListAll,
    },
    {
      id: 'subscription_create',
      label: 'Create subscription',
      description: 'Subscribe a customer to a price.',
      fields: [
        { id: 'customer', label: 'Customer ID', type: 'text', required: true },
        { id: 'priceId', label: 'Price ID', type: 'text', required: true },
        { id: 'metadata', label: 'Metadata JSON', type: 'json' },
      ],
      run: subscriptionCreate,
    },
    {
      id: 'subscription_cancel',
      label: 'Cancel subscription',
      description: 'Cancel a subscription immediately.',
      fields: [
        { id: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      ],
      run: subscriptionCancel,
    },
    {
      id: 'refund_create',
      label: 'Create refund',
      description: 'Refund a charge or payment intent.',
      fields: [
        { id: 'charge', label: 'Charge ID', type: 'text' },
        { id: 'paymentIntent', label: 'Payment Intent ID', type: 'text' },
        { id: 'amount', label: 'Amount (omit for full refund)', type: 'number' },
        {
          id: 'reason',
          label: 'Reason',
          type: 'select',
          options: [
            { label: '—', value: '' },
            { label: 'Duplicate', value: 'duplicate' },
            { label: 'Fraudulent', value: 'fraudulent' },
            { label: 'Requested by customer', value: 'requested_by_customer' },
          ],
        },
        { id: 'metadata', label: 'Metadata JSON', type: 'json' },
      ],
      run: refundCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
