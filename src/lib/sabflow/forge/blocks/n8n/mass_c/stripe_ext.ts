/**
 * Forge block: Stripe (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Stripe/Stripe.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.stripe.com/v1';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.secretKey);
  if (!key) throw new Error('Stripe: secretKey is required');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function flatten(prefix: string, obj: Record<string, unknown>, out: URLSearchParams): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(key, v as Record<string, unknown>, out);
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') {
          flatten(`${key}[${i}]`, item as Record<string, unknown>, out);
        } else {
          out.append(`${key}[${i}]`, asString(item));
        }
      });
    } else if (v != null) {
      out.append(key, asString(v));
    }
  }
}

async function refundCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const charge = asString(ctx.options.charge);
  const amount = asString(ctx.options.amount);
  if (!charge) throw new Error('Stripe: charge is required');
  const form = new URLSearchParams({ charge });
  if (amount) form.set('amount', amount);
  const res = await apiRequest({
    service: 'Stripe',
    method: 'POST',
    url: `${API}/refunds`,
    headers: headers(ctx),
    body: form.toString(),
  });
  return { outputs: { refund: res.data }, logs: [`Stripe refund → ${charge}`] };
}

async function subscriptionCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subscriptionId = asString(ctx.options.subscriptionId);
  if (!subscriptionId) throw new Error('Stripe: subscriptionId is required');
  const res = await apiRequest({
    service: 'Stripe',
    method: 'DELETE',
    url: `${API}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    headers: headers(ctx),
  });
  return { outputs: { subscription: res.data }, logs: [`Stripe sub cancel → ${subscriptionId}`] };
}

async function invoiceFinalize(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const invoiceId = asString(ctx.options.invoiceId);
  if (!invoiceId) throw new Error('Stripe: invoiceId is required');
  const res = await apiRequest({
    service: 'Stripe',
    method: 'POST',
    url: `${API}/invoices/${encodeURIComponent(invoiceId)}/finalize`,
    headers: headers(ctx),
    body: '',
  });
  return { outputs: { invoice: res.data }, logs: [`Stripe invoice finalize → ${invoiceId}`] };
}

async function paymentIntentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const amount = asString(ctx.options.amount);
  const currency = asString(ctx.options.currency);
  if (!amount || !currency) throw new Error('Stripe: amount and currency are required');
  const form = new URLSearchParams({ amount, currency });
  const customer = asString(ctx.options.customer);
  if (customer) form.set('customer', customer);
  const metadataRaw = asString(ctx.options.metadata).trim();
  if (metadataRaw) {
    try {
      flatten('metadata', JSON.parse(metadataRaw), form);
    } catch {
      throw new Error('Stripe: metadata must be JSON');
    }
  }
  const res = await apiRequest({
    service: 'Stripe',
    method: 'POST',
    url: `${API}/payment_intents`,
    headers: headers(ctx),
    body: form.toString(),
  });
  return { outputs: { paymentIntent: res.data }, logs: ['Stripe payment intent create'] };
}

const block: ForgeBlock = {
  id: 'forge_stripe_ext',
  name: 'Stripe (extended)',
  description: 'Stripe ops (refund, cancel subscription, finalize invoice, payment intent).',
  iconName: 'LuCreditCard',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'refund_create',
      label: 'Create refund',
      fields: [
        { id: 'secretKey', label: 'Secret key', type: 'password', required: true },
        { id: 'charge', label: 'Charge ID', type: 'text', required: true },
        { id: 'amount', label: 'Amount (cents)', type: 'number' },
      ],
      run: refundCreate,
    },
    {
      id: 'subscription_cancel',
      label: 'Cancel subscription',
      fields: [
        { id: 'secretKey', label: 'Secret key', type: 'password', required: true },
        { id: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      ],
      run: subscriptionCancel,
    },
    {
      id: 'invoice_finalize',
      label: 'Finalize invoice',
      fields: [
        { id: 'secretKey', label: 'Secret key', type: 'password', required: true },
        { id: 'invoiceId', label: 'Invoice ID', type: 'text', required: true },
      ],
      run: invoiceFinalize,
    },
    {
      id: 'payment_intent_create',
      label: 'Create payment intent',
      fields: [
        { id: 'secretKey', label: 'Secret key', type: 'password', required: true },
        { id: 'amount', label: 'Amount (cents)', type: 'number', required: true },
        { id: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'usd' },
        { id: 'customer', label: 'Customer ID', type: 'text' },
        { id: 'metadata', label: 'Metadata (JSON)', type: 'json' },
      ],
      run: paymentIntentCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
