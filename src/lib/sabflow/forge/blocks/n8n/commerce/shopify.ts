/**
 * Forge block: Shopify
 *
 * Source: n8n-master/packages/nodes-base/nodes/Shopify/Shopify.node.ts
 *   (+ OrderDescription.ts, ProductDescription.ts, GenericFunctions.ts)
 * Credential type: 'shopify' — expected fields:
 *   - shopDomain   (e.g. "my-store.myshopify.com" OR just "my-store")
 *   - accessToken  (Shopify Admin API access token / custom-app token)
 *
 * Operations covered:
 *   - order.create      POST   /orders.json
 *   - order.delete      DELETE /orders/{id}.json
 *   - order.get         GET    /orders/{id}.json
 *   - order.list        GET    /orders.json
 *   - order.listAll     GET    /orders.json (Link-header pagination)
 *   - order.update      PUT    /orders/{id}.json
 *   - product.create    POST   /products.json
 *   - product.delete    DELETE /products/{id}.json
 *   - product.get       GET    /products/{id}.json
 *   - product.list      GET    /products.json
 *   - product.listAll   GET    /products.json (Link-header pagination)
 *   - product.update    PUT    /products/{id}.json
 *   - customer.create   POST   /customers.json   (extension, not in n8n node)
 *   - customer.get      GET    /customers/{id}.json (extension)
 *
 * Out of scope: OAuth flow (use access-token header credentials instead).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString, requireCredential } from '../_shared/http';
import { parseJsonObject } from '../_shared/json';
import { paginateAll } from '../_shared/paginate';
import type { ForgeHttpRequest, ForgeHttpResponse } from '../../../helpers';

const API_VERSION = '2024-10';

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('Shopify', ctx.credential);
  let shop = asString(cred.shopDomain || cred.shop || cred.shopSubdomain);
  if (!shop) throw new Error('Shopify: credential is missing `shopDomain`');
  if (!shop.includes('.')) shop = `${shop}.myshopify.com`;
  return `https://${shop}/admin/api/${API_VERSION}`;
}

/** Shopify Admin API uses a custom `X-Shopify-Access-Token` header rather
 *  than Bearer — handled by the `custom-header` scheme. */
async function shopifyReq(
  ctx: ForgeActionContext,
  req: Omit<ForgeHttpRequest, 'headerName' | 'tokenField'>,
): Promise<ForgeHttpResponse> {
  const r = await ctx.helpers!.requestWithAuthentication('custom-header', {
    ...req,
    headerName: 'X-Shopify-Access-Token',
    tokenField: 'accessToken',
  });
  if (!r.ok) {
    const text =
      typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? null);
    const clip = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`Shopify ${req.method} ${req.url} failed (${r.status}): ${clip}`);
  }
  return r;
}

async function shopifyApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await shopifyReq(ctx, {
    method,
    url: `${baseUrl(ctx)}${path}`,
    json,
  });
  return res.data;
}

function buildQuery(pairs: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(pairs)) {
    const s = asString(v);
    if (s) qs.set(k, s);
  }
  const out = qs.toString();
  return out ? `?${out}` : '';
}

// ── Order ──────────────────────────────────────────────────────────────────

async function orderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const order: Record<string, unknown> = parseJsonObject(ctx.options.order, 'Shopify: order');
  const lineItemsRaw = asString(ctx.options.lineItems).trim();
  if (lineItemsRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lineItemsRaw);
    } catch {
      throw new Error('Shopify: lineItems must be a JSON array');
    }
    if (!Array.isArray(parsed)) throw new Error('Shopify: lineItems must be a JSON array');
    order.line_items = parsed;
  }
  if (!order.line_items || (Array.isArray(order.line_items) && order.line_items.length === 0)) {
    throw new Error('Shopify: at least one line item is required');
  }
  const email = asString(ctx.options.email);
  const note = asString(ctx.options.note);
  if (email) order.email = email;
  if (note) order.note = note;
  if (asString(ctx.options.test)) order.test = asString(ctx.options.test) === 'true';

  const data = await shopifyApi(ctx, 'POST', '/orders.json', { order });
  const created = (data as { order?: { id?: number } } | null)?.order ?? null;
  return {
    outputs: { order: created, id: created?.id ?? null },
    logs: [`Shopify order create → ${created?.id ?? '?'}`],
  };
}

async function orderDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('Shopify: orderId is required');
  await shopifyApi(ctx, 'DELETE', `/orders/${encodeURIComponent(id)}.json`);
  return { outputs: { success: true, orderId: id }, logs: [`Shopify order delete → ${id}`] };
}

async function orderGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('Shopify: orderId is required');
  const data = await shopifyApi(ctx, 'GET', `/orders/${encodeURIComponent(id)}.json`);
  return { outputs: { order: (data as { order?: unknown } | null)?.order ?? data }, logs: [`Shopify order get → ${id}`] };
}

async function orderList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const status = asString(ctx.options.status) || 'any';
  const limit = asString(ctx.options.limit) || '50';
  const data = await shopifyApi(
    ctx,
    'GET',
    `/orders.json?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`,
  );
  const orders = (data as { orders?: unknown[] } | null)?.orders ?? [];
  return { outputs: { orders }, logs: [`Shopify order list → ${Array.isArray(orders) ? orders.length : 0}`] };
}

/**
 * Parse Shopify's `Link` response header and return the URL for `rel="next"`.
 * The header looks like:
 *   <https://shop.myshopify.com/admin/api/2024-10/orders.json?page_info=abc>; rel="next"
 * Multiple links are comma-separated; we only care about `next`.
 */
function nextLinkFromHeader(link: string | null | undefined): string | undefined {
  if (!link) return undefined;
  for (const part of link.split(',')) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (m) return m[1];
  }
  return undefined;
}

async function orderListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const status = asString(ctx.options.status) || 'any';
  const maxItems = Number(asString(ctx.options.maxItems) || '500');
  const pageSize = asString(ctx.options.pageSize) || '250';
  const firstUrl = `${baseUrl(ctx)}/orders.json?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(pageSize)}`;

  const orders = await paginateAll<unknown>({
    maxItems: Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 500,
    async fetchPage(cursor) {
      // The cursor here is a full URL extracted from the Link header — Shopify's
      // page_info tokens are tied to the original query, so we follow the URL
      // verbatim rather than reconstructing it.
      const url = cursor ?? firstUrl;
      const res = await shopifyReq(ctx, { method: 'GET', url });
      const items = ((res.data as { orders?: unknown[] } | null)?.orders ?? []) as unknown[];
      // helpers normalises header keys to lowercase via Headers.forEach.
      const nextCursor = nextLinkFromHeader(res.headers.link);
      return { items, nextCursor };
    },
  });

  return { outputs: { orders, count: orders.length }, logs: [`Shopify order list all → ${orders.length}`] };
}

async function orderUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('Shopify: orderId is required');
  const order: Record<string, unknown> = parseJsonObject(ctx.options.order, 'Shopify: order');
  const note = asString(ctx.options.note);
  const email = asString(ctx.options.email);
  if (note) order.note = note;
  if (email) order.email = email;
  if (Object.keys(order).length === 0) {
    throw new Error('Shopify: at least one updatable field (order JSON, note, email) is required');
  }
  const data = await shopifyApi(ctx, 'PUT', `/orders/${encodeURIComponent(id)}.json`, { order });
  return {
    outputs: { order: (data as { order?: unknown } | null)?.order ?? data },
    logs: [`Shopify order update → ${id}`],
  };
}

// ── Product ────────────────────────────────────────────────────────────────

async function productCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('Shopify: title is required');
  const product: Record<string, unknown> = parseJsonObject(ctx.options.product, 'Shopify: product');
  product.title = title;
  const bodyHtml = asString(ctx.options.bodyHtml);
  const vendor = asString(ctx.options.vendor);
  const productType = asString(ctx.options.productType);
  if (bodyHtml) product.body_html = bodyHtml;
  if (vendor) product.vendor = vendor;
  if (productType) product.product_type = productType;

  const data = await shopifyApi(ctx, 'POST', `/products.json`, { product });
  const created = (data as { product?: { id?: number } } | null)?.product ?? null;
  return {
    outputs: { product: created, id: created?.id ?? null },
    logs: [`Shopify product create → ${created?.id ?? '?'}`],
  };
}

async function productGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.productId);
  if (!id) throw new Error('Shopify: productId is required');
  const data = await shopifyApi(ctx, 'GET', `/products/${encodeURIComponent(id)}.json`);
  return {
    outputs: { product: (data as { product?: unknown } | null)?.product ?? data },
    logs: [`Shopify product get → ${id}`],
  };
}

async function productDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.productId);
  if (!id) throw new Error('Shopify: productId is required');
  await shopifyApi(ctx, 'DELETE', `/products/${encodeURIComponent(id)}.json`);
  return { outputs: { success: true, productId: id }, logs: [`Shopify product delete → ${id}`] };
}

async function productList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit) || '50';
  const vendor = asString(ctx.options.vendor);
  const productType = asString(ctx.options.productType);
  const qs = buildQuery({ limit, vendor, product_type: productType });
  const data = await shopifyApi(ctx, 'GET', `/products.json${qs}`);
  const products = (data as { products?: unknown[] } | null)?.products ?? [];
  return {
    outputs: { products },
    logs: [`Shopify product list → ${Array.isArray(products) ? products.length : 0}`],
  };
}

async function productListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = Number(asString(ctx.options.maxItems) || '500');
  const pageSize = asString(ctx.options.pageSize) || '250';
  const vendor = asString(ctx.options.vendor);
  const productType = asString(ctx.options.productType);
  const firstUrl = `${baseUrl(ctx)}/products.json${buildQuery({
    limit: pageSize,
    vendor,
    product_type: productType,
  })}`;

  const products = await paginateAll<unknown>({
    maxItems: Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 500,
    async fetchPage(cursor) {
      const url = cursor ?? firstUrl;
      const res = await shopifyReq(ctx, { method: 'GET', url });
      const items = ((res.data as { products?: unknown[] } | null)?.products ?? []) as unknown[];
      const nextCursor = nextLinkFromHeader(res.headers.link);
      return { items, nextCursor };
    },
  });

  return {
    outputs: { products, count: products.length },
    logs: [`Shopify product list all → ${products.length}`],
  };
}

async function productUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.productId);
  if (!id) throw new Error('Shopify: productId is required');
  const product: Record<string, unknown> = parseJsonObject(ctx.options.product, 'Shopify: product');
  const title = asString(ctx.options.title);
  const bodyHtml = asString(ctx.options.bodyHtml);
  const vendor = asString(ctx.options.vendor);
  const productType = asString(ctx.options.productType);
  if (title) product.title = title;
  if (bodyHtml) product.body_html = bodyHtml;
  if (vendor) product.vendor = vendor;
  if (productType) product.product_type = productType;
  if (Object.keys(product).length === 0) {
    throw new Error('Shopify: at least one updatable field is required');
  }
  const data = await shopifyApi(ctx, 'PUT', `/products/${encodeURIComponent(id)}.json`, { product });
  return {
    outputs: { product: (data as { product?: unknown } | null)?.product ?? data },
    logs: [`Shopify product update → ${id}`],
  };
}

// ── Customer ───────────────────────────────────────────────────────────────

async function customerCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Shopify: email is required');
  const customer: Record<string, unknown> = parseJsonObject(ctx.options.customer, 'Shopify: customer');
  customer.email = email;
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const phone = asString(ctx.options.phone);
  if (firstName) customer.first_name = firstName;
  if (lastName) customer.last_name = lastName;
  if (phone) customer.phone = phone;

  const data = await shopifyApi(ctx, 'POST', `/customers.json`, { customer });
  const created = (data as { customer?: { id?: number } } | null)?.customer ?? null;
  return {
    outputs: { customer: created, id: created?.id ?? null },
    logs: [`Shopify customer create → ${created?.id ?? '?'}`],
  };
}

async function customerGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Shopify: customerId is required');
  const data = await shopifyApi(ctx, 'GET', `/customers/${encodeURIComponent(id)}.json`);
  return {
    outputs: { customer: (data as { customer?: unknown } | null)?.customer ?? data },
    logs: [`Shopify customer get → ${id}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_shopify',
  name: 'Shopify',
  description: 'Read and write Shopify orders, products and customers via the Admin REST API.',
  iconName: 'LuShoppingBag',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'shopify',
  },
  actions: [
    {
      id: 'order_create',
      label: 'Create order',
      description: 'Create an order; requires at least one line item.',
      fields: [
        {
          id: 'lineItems',
          label: 'Line items (JSON array)',
          type: 'json',
          required: true,
          helperText: 'e.g. [{"variant_id":12345,"quantity":1}]',
        },
        { id: 'email', label: 'Customer email', type: 'text' },
        { id: 'note', label: 'Note', type: 'textarea' },
        {
          id: 'test',
          label: 'Test order',
          type: 'select',
          options: [
            { label: 'No', value: 'false' },
            { label: 'Yes', value: 'true' },
          ],
        },
        { id: 'order', label: 'Order JSON (advanced)', type: 'json' },
      ],
      run: orderCreate,
    },
    {
      id: 'order_delete',
      label: 'Delete order',
      description: 'Delete an order by id.',
      fields: [{ id: 'orderId', label: 'Order ID', type: 'text', required: true }],
      run: orderDelete,
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
      id: 'order_list',
      label: 'List orders',
      description: 'List orders filtered by status.',
      fields: [
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          defaultValue: 'any',
          options: [
            { label: 'Any', value: 'any' },
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
        },
        { id: 'limit', label: 'Limit (max 250)', type: 'number', defaultValue: '50' },
      ],
      run: orderList,
    },
    {
      id: 'order_list_all',
      label: 'List all orders (paginated)',
      description: 'Walk Shopify\'s Link-header pagination and return every matching order up to the cap.',
      fields: [
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          defaultValue: 'any',
          options: [
            { label: 'Any', value: 'any' },
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
        },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 250)', type: 'number', defaultValue: '250' },
      ],
      run: orderListAll,
    },
    {
      id: 'order_update',
      label: 'Update order',
      description: 'Patch an order — provide note/email or a raw JSON order body.',
      fields: [
        { id: 'orderId', label: 'Order ID', type: 'text', required: true },
        { id: 'note', label: 'Note', type: 'textarea' },
        { id: 'email', label: 'Email', type: 'text' },
        {
          id: 'order',
          label: 'Order JSON (advanced)',
          type: 'json',
          helperText: 'Extra fields merged into the order body.',
        },
      ],
      run: orderUpdate,
    },
    {
      id: 'product_create',
      label: 'Create product',
      description: 'Create a product.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'bodyHtml', label: 'Description (HTML)', type: 'textarea' },
        { id: 'vendor', label: 'Vendor', type: 'text' },
        { id: 'productType', label: 'Product type', type: 'text' },
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
      id: 'product_delete',
      label: 'Delete product',
      description: 'Delete a product by id.',
      fields: [{ id: 'productId', label: 'Product ID', type: 'text', required: true }],
      run: productDelete,
    },
    {
      id: 'product_list',
      label: 'List products',
      description: 'List products with optional vendor/type filter.',
      fields: [
        { id: 'limit', label: 'Limit (max 250)', type: 'number', defaultValue: '50' },
        { id: 'vendor', label: 'Vendor', type: 'text' },
        { id: 'productType', label: 'Product type', type: 'text' },
      ],
      run: productList,
    },
    {
      id: 'product_list_all',
      label: 'List all products (paginated)',
      description: "Walk Shopify's Link-header pagination across products.",
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 250)', type: 'number', defaultValue: '250' },
        { id: 'vendor', label: 'Vendor', type: 'text' },
        { id: 'productType', label: 'Product type', type: 'text' },
      ],
      run: productListAll,
    },
    {
      id: 'product_update',
      label: 'Update product',
      description: 'Patch product fields.',
      fields: [
        { id: 'productId', label: 'Product ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'bodyHtml', label: 'Description (HTML)', type: 'textarea' },
        { id: 'vendor', label: 'Vendor', type: 'text' },
        { id: 'productType', label: 'Product type', type: 'text' },
        { id: 'product', label: 'Product JSON (advanced)', type: 'json' },
      ],
      run: productUpdate,
    },
    {
      id: 'customer_create',
      label: 'Create customer',
      description: 'Create a new customer record.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'customer', label: 'Customer JSON (advanced)', type: 'json' },
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
  ],
};

registerForgeBlock(block);
export default block;
