/**
 * Forge block: Shopify (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Shopify/Shopify.node.ts
 *
 * Inline shop name + Admin API access token. Targets ops not in main block.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const shop = asString(ctx.options.shop);
  if (!shop) throw new Error('Shopify: shop is required');
  return `https://${shop}.myshopify.com/admin/api/2024-04`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Shopify: accessToken is required');
  return { 'X-Shopify-Access-Token': token };
}

async function productCount(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Shopify',
    method: 'GET',
    url: `${base(ctx)}/products/count.json`,
    headers: headers(ctx),
  });
  return { outputs: { count: res.data }, logs: ['Shopify product count'] };
}

async function orderClose(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const orderId = asString(ctx.options.orderId);
  if (!orderId) throw new Error('Shopify: orderId is required');
  const res = await apiRequest({
    service: 'Shopify',
    method: 'POST',
    url: `${base(ctx)}/orders/${encodeURIComponent(orderId)}/close.json`,
    headers: headers(ctx),
    json: {},
  });
  return { outputs: { order: res.data }, logs: [`Shopify order close → ${orderId}`] };
}

async function orderRefund(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const orderId = asString(ctx.options.orderId);
  const note = asString(ctx.options.note);
  if (!orderId) throw new Error('Shopify: orderId is required');
  const res = await apiRequest({
    service: 'Shopify',
    method: 'POST',
    url: `${base(ctx)}/orders/${encodeURIComponent(orderId)}/refunds.json`,
    headers: headers(ctx),
    json: { refund: { note: note || 'refunded via SabFlow' } },
  });
  return { outputs: { refund: res.data }, logs: [`Shopify refund → ${orderId}`] };
}

async function customerSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Shopify: query is required');
  const res = await apiRequest({
    service: 'Shopify',
    method: 'GET',
    url: `${base(ctx)}/customers/search.json?query=${encodeURIComponent(query)}`,
    headers: headers(ctx),
  });
  return { outputs: { customers: res.data }, logs: [`Shopify customer search → ${query}`] };
}

const block: ForgeBlock = {
  id: 'forge_shopify_ext',
  name: 'Shopify (extended)',
  description: 'Shopify ops (product count, close order, refund, customer search).',
  iconName: 'LuShoppingBag',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'product_count',
      label: 'Count products',
      fields: [
        { id: 'shop', label: 'Shop subdomain', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
      ],
      run: productCount,
    },
    {
      id: 'order_close',
      label: 'Close order',
      fields: [
        { id: 'shop', label: 'Shop subdomain', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'orderId', label: 'Order ID', type: 'text', required: true },
      ],
      run: orderClose,
    },
    {
      id: 'order_refund',
      label: 'Refund order',
      fields: [
        { id: 'shop', label: 'Shop subdomain', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'orderId', label: 'Order ID', type: 'text', required: true },
        { id: 'note', label: 'Note', type: 'text' },
      ],
      run: orderRefund,
    },
    {
      id: 'customer_search',
      label: 'Search customers',
      fields: [
        { id: 'shop', label: 'Shop subdomain', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
      ],
      run: customerSearch,
    },
  ],
};

registerForgeBlock(block);
export default block;
