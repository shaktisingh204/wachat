/**
 * Forge block: Paddle
 *
 * Source: n8n-master/packages/nodes-base/nodes/Paddle/Paddle.node.ts
 *   (+ GenericFunctions.ts — production: https://vendors.paddle.com/api,
 *      sandbox: https://sandbox-vendors.paddle.com/api)
 * Credential type: 'paddle' — expected fields:
 *   - vendorId       (numeric Paddle vendor id)
 *   - vendorAuthCode (vendor auth code)
 *   - sandbox        (optional "true"/"false")
 *
 * NOTE: This wraps the legacy Paddle Classic Vendors API (vendor + auth code
 * in the form body). The newer Billing API (https://api.paddle.com/) uses a
 * bearer token; switch credential layout when we wire it up in a follow-up.
 *
 * Operations covered:
 *   - product.get          POST /2.0/product/get_products (filtered)
 *   - product.list         POST /2.0/product/get_products
 *   - subscription.cancel  POST /2.0/subscription/users_cancel
 *   - transaction.list     POST /2.0/subscription/transactions
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asString, requireCredential } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('Paddle', ctx.credential);
  return asBoolean(cred.sandbox)
    ? 'https://sandbox-vendors.paddle.com/api'
    : 'https://vendors.paddle.com/api';
}

function authForm(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Paddle', ctx.credential);
  const vendorId = asString(cred.vendorId);
  const vendorAuthCode = asString(cred.vendorAuthCode);
  if (!vendorId || !vendorAuthCode) {
    throw new Error('Paddle: credential is missing `vendorId` or `vendorAuthCode`');
  }
  return { vendor_id: vendorId, vendor_auth_code: vendorAuthCode };
}

function encodeForm(input: Record<string, string | number | undefined>): string {
  return Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function paddleApi(
  ctx: ForgeActionContext,
  path: string,
  form: Record<string, string | number | undefined>,
): Promise<unknown> {
  const body = encodeForm({ ...authForm(ctx), ...form });
  const res = await apiRequest({
    service: 'Paddle',
    method: 'POST',
    url: `${baseUrl(ctx)}${path}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = res.data as { success?: boolean; error?: { code: number; message: string }; response?: unknown } | null;
  if (data && data.success === false && data.error) {
    throw new Error(`Paddle API error ${data.error.code}: ${data.error.message}`);
  }
  return data?.response ?? data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function productGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.productId);
  if (!id) throw new Error('Paddle: productId is required');
  const all = (await paddleApi(ctx, '/2.0/product/get_products', {})) as { products?: Array<{ id: number }> } | null;
  const product = all?.products?.find((p) => String(p.id) === id) ?? null;
  return { outputs: { product }, logs: [`Paddle product get → ${id} ${product ? 'ok' : 'missing'}`] };
}

async function productList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = (await paddleApi(ctx, '/2.0/product/get_products', {})) as { products?: unknown[] } | null;
  return {
    outputs: { products: data?.products ?? [] },
    logs: [`Paddle product list → ${Array.isArray(data?.products) ? data!.products!.length : 0}`],
  };
}

async function subscriptionCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subscriptionId = asString(ctx.options.subscriptionId);
  if (!subscriptionId) throw new Error('Paddle: subscriptionId is required');
  const data = await paddleApi(ctx, '/2.0/subscription/users_cancel', { subscription_id: subscriptionId });
  return { outputs: { result: data }, logs: [`Paddle subscription cancel → ${subscriptionId}`] };
}

async function transactionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const entity = asString(ctx.options.entity) || 'subscription';
  const entityId = asString(ctx.options.entityId);
  if (!entityId) throw new Error('Paddle: entityId is required');
  const data = (await paddleApi(ctx, `/2.0/${entity}/${encodeURIComponent(entityId)}/transactions`, {})) as
    | unknown[]
    | null;
  return {
    outputs: { transactions: data ?? [] },
    logs: [`Paddle transaction list → ${Array.isArray(data) ? data.length : 0}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_paddle',
  name: 'Paddle',
  description: 'Inspect Paddle products, transactions and manage subscriptions (Classic Vendors API).',
  iconName: 'LuCreditCard',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'paddle',
  },
  actions: [
    {
      id: 'product_get',
      label: 'Get product',
      description: 'Fetch a single product by id (filtered from list).',
      fields: [
        { id: 'productId', label: 'Product ID', type: 'text', required: true },
      ],
      run: productGet,
    },
    {
      id: 'product_list',
      label: 'List products',
      description: 'List all vendor products.',
      fields: [],
      run: productList,
    },
    {
      id: 'subscription_cancel',
      label: 'Cancel subscription',
      description: 'Cancel a subscription by its Paddle subscription id.',
      fields: [
        { id: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      ],
      run: subscriptionCancel,
    },
    {
      id: 'transaction_list',
      label: 'List transactions',
      description: 'List transactions for a user, subscription, order or product.',
      fields: [
        {
          id: 'entity',
          label: 'Entity',
          type: 'select',
          defaultValue: 'subscription',
          options: [
            { label: 'Subscription', value: 'subscription' },
            { label: 'User', value: 'user' },
            { label: 'Order', value: 'order' },
            { label: 'Product', value: 'product' },
            { label: 'Checkout', value: 'checkout' },
          ],
        },
        { id: 'entityId', label: 'Entity ID', type: 'text', required: true },
      ],
      run: transactionList,
    },
  ],
};

registerForgeBlock(block);
export default block;
