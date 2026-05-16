/**
 * Forge block: Lemon Squeezy
 *
 * `https://api.lemonsqueezy.com/v1` — checkouts, subscriptions, customers.
 * Auth: Bearer API key + JSON:API content type.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.lemonsqueezy.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Lemon Squeezy: apiKey is required');
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
  };
}

function parseOptionalJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Lemon Squeezy: ${label} must be valid JSON`);
  }
}

async function createCheckout(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const storeId = asString(ctx.options.storeId);
  const variantId = asString(ctx.options.variantId);
  const productOptions = parseOptionalJson(ctx.options.productOptions, 'productOptions');
  const checkoutOptions = parseOptionalJson(ctx.options.checkoutOptions, 'checkoutOptions');
  const customData = parseOptionalJson(ctx.options.customData, 'customData');
  if (!storeId) throw new Error('Lemon Squeezy: storeId is required');
  if (!variantId) throw new Error('Lemon Squeezy: variantId is required');
  const attributes: Record<string, unknown> = {};
  if (productOptions) attributes.product_options = productOptions;
  if (checkoutOptions) attributes.checkout_options = checkoutOptions;
  if (customData) attributes.checkout_data = { custom: customData };
  const body = {
    data: {
      type: 'checkouts',
      attributes,
      relationships: {
        store: { data: { type: 'stores', id: storeId } },
        variant: { data: { type: 'variants', id: variantId } },
      },
    },
  };
  const res = await apiRequest({
    service: 'Lemon Squeezy',
    method: 'POST',
    url: `${API}/checkouts`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { checkout: res.data }, logs: [`Lemon Squeezy create checkout → variant ${variantId}`] };
}

async function getSubscription(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.subscriptionId);
  if (!id) throw new Error('Lemon Squeezy: subscriptionId is required');
  const res = await apiRequest({
    service: 'Lemon Squeezy',
    method: 'GET',
    url: `${API}/subscriptions/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { subscription: res.data }, logs: [`Lemon Squeezy get subscription → ${id}`] };
}

async function cancelSubscription(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.subscriptionId);
  if (!id) throw new Error('Lemon Squeezy: subscriptionId is required');
  const res = await apiRequest({
    service: 'Lemon Squeezy',
    method: 'DELETE',
    url: `${API}/subscriptions/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { subscription: res.data }, logs: [`Lemon Squeezy cancel subscription → ${id}`] };
}

async function listCustomers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const storeId = asString(ctx.options.storeId);
  const email = asString(ctx.options.email);
  const params = new URLSearchParams();
  if (storeId) params.set('filter[store_id]', storeId);
  if (email) params.set('filter[email]', email);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Lemon Squeezy',
    method: 'GET',
    url: `${API}/customers${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { customers: res.data }, logs: ['Lemon Squeezy list customers'] };
}

const block: ForgeBlock = {
  id: 'forge_lemon_squeezy',
  name: 'Lemon Squeezy',
  description: 'Create checkouts and manage subscriptions / customers on Lemon Squeezy.',
  iconName: 'LuShoppingCart',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'create_checkout',
      label: 'Create checkout',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'storeId', label: 'Store ID', type: 'text', required: true },
        { id: 'variantId', label: 'Variant ID', type: 'text', required: true },
        { id: 'productOptions', label: 'Product options (JSON)', type: 'json' },
        { id: 'checkoutOptions', label: 'Checkout options (JSON)', type: 'json' },
        { id: 'customData', label: 'Custom checkout data (JSON)', type: 'json' },
      ],
      run: createCheckout,
    },
    {
      id: 'get_subscription',
      label: 'Get subscription',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      ],
      run: getSubscription,
    },
    {
      id: 'cancel_subscription',
      label: 'Cancel subscription',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      ],
      run: cancelSubscription,
    },
    {
      id: 'list_customers',
      label: 'List customers',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'storeId', label: 'Store ID', type: 'text' },
        { id: 'email', label: 'Email filter', type: 'text' },
      ],
      run: listCustomers,
    },
  ],
};

registerForgeBlock(block);
export default block;
