/**
 * Forge block: Magento 2
 *
 * Source: n8n-master/packages/nodes-base/nodes/Magento/Magento2.node.ts
 *   (+ GenericFunctions.ts — base: `${credentials.host}` with /rest/V1 paths)
 * Credential type: 'magento' — expected fields:
 *   - host         (storefront base, e.g. "https://shop.example.com/rest/V1"
 *                   or "https://shop.example.com" — we normalise both)
 *   - accessToken  (admin or integration token)
 *
 * Operations covered:
 *   - order.get        GET    /orders/{id}
 *   - product.create   POST   /products
 *   - product.get      GET    /products/{sku}
 *   - customer.get     GET    /customers/{id}
 *
 * Out of scope: search criteria filters, customer create/update (heavy schema)
 * — re-add when needed.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('Magento', ctx.credential);
  let host = asString(cred.host || cred.url);
  if (!host) throw new Error('Magento: credential is missing `host`');
  host = host.replace(/\/+$/, '');
  if (!/\/rest\/V\d/i.test(host)) host = `${host}/rest/V1`;
  return host;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Magento', ctx.credential);
  const token = asString(cred.accessToken || cred.apiKey);
  if (!token) throw new Error('Magento: credential is missing `accessToken`');
  return { Authorization: `Bearer ${token}` };
}

async function magentoApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Magento',
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
  throw new Error(`Magento: ${label} must be a JSON object`);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function orderGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('Magento: orderId is required');
  const data = await magentoApi(ctx, 'GET', `/orders/${encodeURIComponent(id)}`);
  return { outputs: { order: data }, logs: [`Magento order get → ${id}`] };
}

async function productCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sku = asString(ctx.options.sku);
  const name = asString(ctx.options.name);
  if (!sku) throw new Error('Magento: sku is required');
  if (!name) throw new Error('Magento: name is required');

  const product: Record<string, unknown> = {
    sku,
    name,
    price: ctx.options.price ? Number(asString(ctx.options.price)) : undefined,
    status: ctx.options.status ? Number(asString(ctx.options.status)) : 1,
    visibility: ctx.options.visibility ? Number(asString(ctx.options.visibility)) : 4,
    type_id: asString(ctx.options.typeId) || 'simple',
    attribute_set_id: ctx.options.attributeSetId ? Number(asString(ctx.options.attributeSetId)) : 4,
  };
  const extra = parseJsonObject(ctx.options.extra, 'extra');
  Object.assign(product, extra);

  const data = (await magentoApi(ctx, 'POST', '/products', { product })) as { id?: number; sku?: string } | null;
  return {
    outputs: { product: data, sku: data?.sku ?? sku },
    logs: [`Magento product create → ${data?.sku ?? sku}`],
  };
}

async function productGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sku = asString(ctx.options.sku);
  if (!sku) throw new Error('Magento: sku is required');
  const data = await magentoApi(ctx, 'GET', `/products/${encodeURIComponent(sku)}`);
  return { outputs: { product: data }, logs: [`Magento product get → ${sku}`] };
}

async function customerGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Magento: customerId is required');
  const data = await magentoApi(ctx, 'GET', `/customers/${encodeURIComponent(id)}`);
  return { outputs: { customer: data }, logs: [`Magento customer get → ${id}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_magento',
  name: 'Magento 2',
  description: 'Read Magento 2 orders, products and customers; create simple products.',
  iconName: 'LuShoppingBag',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'magento',
  },
  actions: [
    {
      id: 'order_get',
      label: 'Get order',
      description: 'Fetch a Magento order by entity id.',
      fields: [
        { id: 'orderId', label: 'Order ID', type: 'text', required: true },
      ],
      run: orderGet,
    },
    {
      id: 'product_create',
      label: 'Create product',
      description: 'Create a simple product.',
      fields: [
        { id: 'sku', label: 'SKU', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'price', label: 'Price', type: 'number' },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          defaultValue: '1',
          options: [
            { label: 'Enabled', value: '1' },
            { label: 'Disabled', value: '2' },
          ],
        },
        {
          id: 'visibility',
          label: 'Visibility',
          type: 'select',
          defaultValue: '4',
          options: [
            { label: 'Not visible individually', value: '1' },
            { label: 'Catalog', value: '2' },
            { label: 'Search', value: '3' },
            { label: 'Catalog, Search', value: '4' },
          ],
        },
        { id: 'typeId', label: 'Type', type: 'text', defaultValue: 'simple' },
        { id: 'attributeSetId', label: 'Attribute set ID', type: 'number', defaultValue: '4' },
        { id: 'extra', label: 'Extra product JSON (advanced)', type: 'json' },
      ],
      run: productCreate,
    },
    {
      id: 'product_get',
      label: 'Get product',
      description: 'Fetch a product by SKU.',
      fields: [
        { id: 'sku', label: 'SKU', type: 'text', required: true },
      ],
      run: productGet,
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
  ],
};

registerForgeBlock(block);
export default block;
