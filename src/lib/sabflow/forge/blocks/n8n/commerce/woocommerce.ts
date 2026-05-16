/**
 * Forge block: WooCommerce
 *
 * Source: n8n-master/packages/nodes-base/nodes/WooCommerce/WooCommerce.node.ts
 *   (+ GenericFunctions.ts: `${url}/wp-json/wc/v3${resource}`)
 * Credential type: 'woocommerce' — expected fields:
 *   - url             (storefront base url, e.g. "https://shop.example.com")
 *   - consumerKey     (Woo REST API consumer key)
 *   - consumerSecret  (Woo REST API consumer secret)
 *
 * Operations covered:
 *   - order.create    POST  /orders
 *   - order.get       GET   /orders/{id}
 *   - order.update    PUT   /orders/{id}
 *   - product.create  POST  /products
 *   - product.get     GET   /products/{id}
 *   - product.list    GET   /products
 *
 * Auth: HTTP Basic with consumerKey:consumerSecret.
 *
 * Out of scope for the first port: pagination, refunds, coupons, customers,
 * webhook management — re-add when needed.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

function b64(input: string): string {
  if (typeof btoa === 'function') return btoa(input);
  const g = globalThis as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } };
  if (g.Buffer) return g.Buffer.from(input).toString('base64');
  throw new Error('WooCommerce: no base64 encoder available in this runtime');
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('WooCommerce', ctx.credential);
  const key = asString(cred.consumerKey);
  const secret = asString(cred.consumerSecret);
  if (!key || !secret) {
    throw new Error('WooCommerce: credential is missing `consumerKey` or `consumerSecret`');
  }
  return { Authorization: `Basic ${b64(`${key}:${secret}`)}` };
}

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('WooCommerce', ctx.credential);
  let url = asString(cred.url);
  if (!url) throw new Error('WooCommerce: credential is missing `url`');
  url = url.replace(/\/+$/, '');
  return `${url}/wp-json/wc/v3`;
}

async function wcApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'WooCommerce',
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
  throw new Error(`WooCommerce: ${label} must be a JSON object`);
}

// ── Order ──────────────────────────────────────────────────────────────────

async function orderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const order: Record<string, unknown> = parseJsonObject(ctx.options.order, 'order');
  const status = asString(ctx.options.status);
  const customerId = asString(ctx.options.customerId);
  const paymentMethod = asString(ctx.options.paymentMethod);
  if (status) order.status = status;
  if (customerId) order.customer_id = Number(customerId);
  if (paymentMethod) order.payment_method = paymentMethod;
  const data = (await wcApi(ctx, 'POST', '/orders', order)) as { id?: number } | null;
  return { outputs: { order: data, id: data?.id ?? null }, logs: [`WooCommerce order create → ${data?.id ?? '?'}`] };
}

async function orderGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('WooCommerce: orderId is required');
  const data = await wcApi(ctx, 'GET', `/orders/${encodeURIComponent(id)}`);
  return { outputs: { order: data }, logs: [`WooCommerce order get → ${id}`] };
}

async function orderUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('WooCommerce: orderId is required');
  const order: Record<string, unknown> = parseJsonObject(ctx.options.order, 'order');
  const status = asString(ctx.options.status);
  if (status) order.status = status;
  if (Object.keys(order).length === 0) {
    throw new Error('WooCommerce: at least one updatable field (status or order JSON) is required');
  }
  const data = await wcApi(ctx, 'PUT', `/orders/${encodeURIComponent(id)}`, order);
  return { outputs: { order: data }, logs: [`WooCommerce order update → ${id}`] };
}

async function orderListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const status = asString(ctx.options.status);
  const pageSize = asString(ctx.options.pageSize) || '100';
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const headers = authHeaders(ctx);
  const base = baseUrl(ctx);

  const orders = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ?? '1';
      const qs = new URLSearchParams();
      qs.set('per_page', pageSize);
      qs.set('page', page);
      if (status) qs.set('status', status);
      const res = await apiRequest({
        service: 'WooCommerce',
        method: 'GET',
        url: `${base}/orders?${qs.toString()}`,
        headers,
      });
      const items = ((res.data as unknown[] | null) ?? []) as unknown[];
      const totalPagesHeader = res.headers.get('x-wp-totalpages');
      const totalPages = totalPagesHeader ? Number(totalPagesHeader) : NaN;
      const current = Number(page);
      const more = Number.isFinite(totalPages) ? current < totalPages : items.length === Number(pageSize);
      const nextCursor = more ? String(current + 1) : undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { orders, count: orders.length },
    logs: [`WooCommerce order list all → ${orders.length}`],
  };
}

// ── Product ────────────────────────────────────────────────────────────────

async function productCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('WooCommerce: name is required');
  const product: Record<string, unknown> = parseJsonObject(ctx.options.product, 'product');
  product.name = name;
  const regularPrice = asString(ctx.options.regularPrice);
  const description = asString(ctx.options.description);
  const sku = asString(ctx.options.sku);
  if (regularPrice) product.regular_price = regularPrice;
  if (description) product.description = description;
  if (sku) product.sku = sku;
  const data = (await wcApi(ctx, 'POST', '/products', product)) as { id?: number } | null;
  return { outputs: { product: data, id: data?.id ?? null }, logs: [`WooCommerce product create → ${data?.id ?? '?'}`] };
}

async function productGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.productId);
  if (!id) throw new Error('WooCommerce: productId is required');
  const data = await wcApi(ctx, 'GET', `/products/${encodeURIComponent(id)}`);
  return { outputs: { product: data }, logs: [`WooCommerce product get → ${id}`] };
}

async function productList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const perPage = asString(ctx.options.perPage) || '20';
  const search = asString(ctx.options.search);
  const qs = new URLSearchParams();
  qs.set('per_page', perPage);
  if (search) qs.set('search', search);
  const data = (await wcApi(ctx, 'GET', `/products?${qs.toString()}`)) as unknown[] | null;
  const count = Array.isArray(data) ? data.length : 0;
  return { outputs: { products: data ?? [] }, logs: [`WooCommerce product list → ${count}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_woocommerce',
  name: 'WooCommerce',
  description: 'Read and write WooCommerce orders and products via the WC REST API.',
  iconName: 'LuShoppingCart',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'woocommerce',
  },
  actions: [
    {
      id: 'order_create',
      label: 'Create order',
      description: 'Create a new order.',
      fields: [
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Processing', value: 'processing' },
            { label: 'On hold', value: 'on-hold' },
            { label: 'Completed', value: 'completed' },
            { label: 'Cancelled', value: 'cancelled' },
            { label: 'Refunded', value: 'refunded' },
            { label: 'Failed', value: 'failed' },
          ],
        },
        { id: 'customerId', label: 'Customer ID', type: 'number' },
        { id: 'paymentMethod', label: 'Payment method', type: 'text' },
        { id: 'order', label: 'Order JSON (advanced)', type: 'json' },
      ],
      run: orderCreate,
    },
    {
      id: 'order_get',
      label: 'Get order',
      description: 'Fetch a single order by id.',
      fields: [
        { id: 'orderId', label: 'Order ID', type: 'text', required: true },
      ],
      run: orderGet,
    },
    {
      id: 'order_update',
      label: 'Update order',
      description: 'Update an order — status or arbitrary JSON.',
      fields: [
        { id: 'orderId', label: 'Order ID', type: 'text', required: true },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'Pending', value: 'pending' },
            { label: 'Processing', value: 'processing' },
            { label: 'On hold', value: 'on-hold' },
            { label: 'Completed', value: 'completed' },
            { label: 'Cancelled', value: 'cancelled' },
            { label: 'Refunded', value: 'refunded' },
            { label: 'Failed', value: 'failed' },
          ],
        },
        { id: 'order', label: 'Order JSON (advanced)', type: 'json' },
      ],
      run: orderUpdate,
    },
    {
      id: 'order_list_all',
      label: 'List all orders (paginated)',
      description: 'Walk WooCommerce\'s page-based pagination (X-WP-TotalPages) and return every order up to the cap.',
      fields: [
        {
          id: 'status',
          label: 'Status (optional)',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'Pending', value: 'pending' },
            { label: 'Processing', value: 'processing' },
            { label: 'On hold', value: 'on-hold' },
            { label: 'Completed', value: 'completed' },
            { label: 'Cancelled', value: 'cancelled' },
            { label: 'Refunded', value: 'refunded' },
            { label: 'Failed', value: 'failed' },
          ],
        },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
      ],
      run: orderListAll,
    },
    {
      id: 'product_create',
      label: 'Create product',
      description: 'Create a simple product.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'regularPrice', label: 'Regular price', type: 'text' },
        { id: 'sku', label: 'SKU', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'product', label: 'Product JSON (advanced)', type: 'json' },
      ],
      run: productCreate,
    },
    {
      id: 'product_get',
      label: 'Get product',
      description: 'Fetch a product by id.',
      fields: [
        { id: 'productId', label: 'Product ID', type: 'text', required: true },
      ],
      run: productGet,
    },
    {
      id: 'product_list',
      label: 'List products',
      description: 'List products with optional search.',
      fields: [
        { id: 'perPage', label: 'Per page (max 100)', type: 'number', defaultValue: '20' },
        { id: 'search', label: 'Search', type: 'text' },
      ],
      run: productList,
    },
  ],
};

registerForgeBlock(block);
export default block;
