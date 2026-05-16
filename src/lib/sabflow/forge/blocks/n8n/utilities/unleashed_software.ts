/**
 * Forge block: Unleashed Software
 *
 * Source: n8n-master/packages/nodes-base/nodes/UnleashedSoftware/UnleashedSoftware.node.ts
 * Auth: `api-auth-id` + `api-auth-signature` (HMAC-SHA256 of the query string)
 *       provided inline as `password` fields.
 *
 * Operations covered:
 *   - customer.list     GET /Customers
 *   - product.list      GET /Products
 *   - sales-order.list  GET /SalesOrders
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.unleashedsoftware.com';

async function buildHeaders(ctx: ForgeActionContext, query: string): Promise<Record<string, string>> {
  const { createHmac } = await import('node:crypto');
  const id = asString(ctx.options.apiId);
  const key = asString(ctx.options.apiKey);
  if (!id) throw new Error('Unleashed: apiId is required');
  if (!key) throw new Error('Unleashed: apiKey is required');
  const signature = createHmac('sha256', key).update(query).digest('base64');
  return {
    'api-auth-id': id,
    'api-auth-signature': signature,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'client-type': 'n8n-sabflow/forge',
  };
}

async function listRequest(
  ctx: ForgeActionContext,
  resource: string,
  label: string,
  outputKey: string,
): Promise<ForgeActionResult> {
  const page = asNumber(ctx.options.page) ?? 1;
  const pageSize = asNumber(ctx.options.pageSize);
  const params = new URLSearchParams();
  if (pageSize) params.set('pageSize', String(pageSize));
  const query = params.toString();
  const url = `${API}/${resource}/${page}${query ? `?${query}` : ''}`;
  const res = await apiRequest({
    service: 'Unleashed',
    method: 'GET',
    url,
    headers: await buildHeaders(ctx, query),
  });
  return { outputs: { [outputKey]: res.data }, logs: [`Unleashed ${label} list → page ${page}`] };
}

const block: ForgeBlock = {
  id: 'forge_unleashed_software',
  name: 'Unleashed Software',
  description: 'Read customers, products and sales orders from Unleashed inventory.',
  iconName: 'LuPackage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'customer_list',
      label: 'List customers',
      description: 'Fetch a page of customers.',
      fields: [
        { id: 'apiId', label: 'API ID', type: 'password', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'page', label: 'Page', type: 'number', defaultValue: 1 },
        { id: 'pageSize', label: 'Page size', type: 'number', placeholder: '200' },
      ],
      run: (ctx) => listRequest(ctx, 'Customers', 'customers', 'customers'),
    },
    {
      id: 'product_list',
      label: 'List products',
      description: 'Fetch a page of products.',
      fields: [
        { id: 'apiId', label: 'API ID', type: 'password', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'page', label: 'Page', type: 'number', defaultValue: 1 },
        { id: 'pageSize', label: 'Page size', type: 'number', placeholder: '200' },
      ],
      run: (ctx) => listRequest(ctx, 'Products', 'products', 'products'),
    },
    {
      id: 'sales_order_list',
      label: 'List sales orders',
      description: 'Fetch a page of sales orders.',
      fields: [
        { id: 'apiId', label: 'API ID', type: 'password', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'page', label: 'Page', type: 'number', defaultValue: 1 },
        { id: 'pageSize', label: 'Page size', type: 'number', placeholder: '200' },
      ],
      run: (ctx) => listRequest(ctx, 'SalesOrders', 'sales-orders', 'salesOrders'),
    },
  ],
};

registerForgeBlock(block);
export default block;
