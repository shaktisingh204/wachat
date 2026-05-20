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
 *   - customer.create   POST   /customers
 *   - customer.delete   DELETE /customers/{id}
 *   - customer.get      GET    /customers/{id}
 *   - customer.getAll   GET    /customers/search
 *   - customer.update   PUT    /customers/{id}
 *   - invoice.create    POST   /order/{orderId}/invoice
 *   - order.cancel      POST   /orders/{id}/cancel
 *   - order.get         GET    /orders/{id}
 *   - order.getAll      GET    /orders          (searchCriteria)
 *   - order.ship        POST   /order/{id}/ship
 *   - product.create    POST   /products
 *   - product.delete    DELETE /products/{sku}
 *   - product.get       GET    /products/{sku}
 *   - product.getAll    GET    /products        (searchCriteria)
 *   - product.update    PUT    /products/{sku}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asNumber, asString, requireCredential } from '../_shared/http';

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
  query?: Record<string, string>,
): Promise<unknown> {
  let url = `${baseUrl(ctx)}${path}`;
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams(query).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }
  const res = await apiRequest({
    service: 'Magento',
    method,
    url,
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

/**
 * Magento's REST API expects searchCriteria flattened into bracketed query
 * params (e.g. `searchCriteria[filter_groups][0][filters][0][field]=email`).
 * URLSearchParams does not bracket-encode nested objects, so we walk the
 * tree ourselves and emit one key per leaf.
 */
function flattenSearchCriteria(
  obj: Record<string, unknown>,
  prefix = 'searchCriteria',
  out: Record<string, string> = {},
): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = `${prefix}[${k}]`;
    if (v == null) continue;
    if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          flattenSearchCriteria(item as Record<string, unknown>, `${key}[${idx}]`, out);
        } else {
          out[`${key}[${idx}]`] = String(item);
        }
      });
    } else if (typeof v === 'object') {
      flattenSearchCriteria(v as Record<string, unknown>, key, out);
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

function buildSearchQuery(ctx: ForgeActionContext): Record<string, string> {
  const filterJson = asString(ctx.options.filterJson).trim();
  const limit = asNumber(ctx.options.limit) ?? 50;
  const pageSize = Math.min(Math.max(limit, 1), 200);

  // Either user supplies a full searchCriteria payload as JSON, or we
  // build a trivial one with just page_size (n8n's "none" filter type).
  let criteria: Record<string, unknown>;
  if (filterJson) {
    const parsed = parseJsonObject(filterJson, 'filterJson');
    // Accept both `{ search_criteria: { … } }` and a flat criteria object.
    criteria =
      'search_criteria' in parsed
        ? ((parsed.search_criteria as Record<string, unknown>) ?? {})
        : parsed;
  } else {
    criteria = {};
  }
  criteria.page_size = pageSize;

  // n8n uses snake_case keys (`filter_groups`, `sort_orders`) internally,
  // but Magento's REST endpoint expects camelCase under `searchCriteria`.
  const camel: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(criteria)) {
    const ck = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    camel[ck] = v;
  }
  return flattenSearchCriteria(camel);
}

// ── Customer actions ───────────────────────────────────────────────────────

async function customerCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const firstname = asString(ctx.options.firstname);
  const lastname = asString(ctx.options.lastname);
  if (!email) throw new Error('Magento: email is required');
  if (!firstname) throw new Error('Magento: firstname is required');
  if (!lastname) throw new Error('Magento: lastname is required');

  const body: Record<string, unknown> = {
    customer: { email, firstname, lastname, ...parseJsonObject(ctx.options.extra, 'extra') },
  };
  const password = asString(ctx.options.password);
  if (password) body.password = password;

  const data = await magentoApi(ctx, 'POST', '/customers', body);
  return { outputs: { customer: data }, logs: [`Magento customer create → ${email}`] };
}

async function customerDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Magento: customerId is required');
  await magentoApi(ctx, 'DELETE', `/customers/${encodeURIComponent(id)}`);
  return { outputs: { success: true, customerId: id }, logs: [`Magento customer delete → ${id}`] };
}

async function customerGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Magento: customerId is required');
  const data = await magentoApi(ctx, 'GET', `/customers/${encodeURIComponent(id)}`);
  return { outputs: { customer: data }, logs: [`Magento customer get → ${id}`] };
}

async function customerGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = buildSearchQuery(ctx);
  const data = (await magentoApi(ctx, 'GET', '/customers/search', undefined, query)) as
    | { items?: unknown[]; total_count?: number }
    | null;
  const items = data?.items ?? [];
  return {
    outputs: { customers: items, totalCount: data?.total_count ?? items.length },
    logs: [`Magento customer search → ${items.length}`],
  };
}

async function customerUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Magento: customerId is required');
  const customer: Record<string, unknown> = {
    id: Number.parseInt(id, 10),
    website_id: 0,
    ...parseJsonObject(ctx.options.extra, 'extra'),
  };
  const email = asString(ctx.options.email);
  const firstname = asString(ctx.options.firstname);
  const lastname = asString(ctx.options.lastname);
  if (email) customer.email = email;
  if (firstname) customer.firstname = firstname;
  if (lastname) customer.lastname = lastname;
  const body: Record<string, unknown> = { customer };
  const password = asString(ctx.options.password);
  if (password) body.password = password;
  const data = await magentoApi(ctx, 'PUT', `/customers/${encodeURIComponent(id)}`, body);
  return { outputs: { customer: data }, logs: [`Magento customer update → ${id}`] };
}

// ── Invoice actions ────────────────────────────────────────────────────────

async function invoiceCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const orderId = asString(ctx.options.orderId);
  if (!orderId) throw new Error('Magento: orderId is required');
  const data = await magentoApi(ctx, 'POST', `/order/${encodeURIComponent(orderId)}/invoice`);
  return {
    outputs: { invoiceId: data, orderId },
    logs: [`Magento invoice create → order ${orderId}`],
  };
}

// ── Order actions ──────────────────────────────────────────────────────────

async function orderCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('Magento: orderId is required');
  await magentoApi(ctx, 'POST', `/orders/${encodeURIComponent(id)}/cancel`);
  return { outputs: { success: true, orderId: id }, logs: [`Magento order cancel → ${id}`] };
}

async function orderGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('Magento: orderId is required');
  const data = await magentoApi(ctx, 'GET', `/orders/${encodeURIComponent(id)}`);
  return { outputs: { order: data }, logs: [`Magento order get → ${id}`] };
}

async function orderGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = buildSearchQuery(ctx);
  const data = (await magentoApi(ctx, 'GET', '/orders', undefined, query)) as
    | { items?: unknown[]; total_count?: number }
    | null;
  const items = data?.items ?? [];
  return {
    outputs: { orders: items, totalCount: data?.total_count ?? items.length },
    logs: [`Magento order search → ${items.length}`],
  };
}

async function orderShip(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orderId);
  if (!id) throw new Error('Magento: orderId is required');
  const data = await magentoApi(ctx, 'POST', `/order/${encodeURIComponent(id)}/ship`);
  return {
    outputs: { shipmentId: data, orderId: id },
    logs: [`Magento order ship → ${id}`],
  };
}

// ── Product actions ────────────────────────────────────────────────────────

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

async function productDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sku = asString(ctx.options.sku);
  if (!sku) throw new Error('Magento: sku is required');
  await magentoApi(ctx, 'DELETE', `/products/${encodeURIComponent(sku)}`);
  return { outputs: { success: true, sku }, logs: [`Magento product delete → ${sku}`] };
}

async function productGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sku = asString(ctx.options.sku);
  if (!sku) throw new Error('Magento: sku is required');
  const data = await magentoApi(ctx, 'GET', `/products/${encodeURIComponent(sku)}`);
  return { outputs: { product: data }, logs: [`Magento product get → ${sku}`] };
}

async function productGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = buildSearchQuery(ctx);
  const data = (await magentoApi(ctx, 'GET', '/products', undefined, query)) as
    | { items?: unknown[]; total_count?: number }
    | null;
  const items = data?.items ?? [];
  return {
    outputs: { products: items, totalCount: data?.total_count ?? items.length },
    logs: [`Magento product search → ${items.length}`],
  };
}

async function productUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sku = asString(ctx.options.sku);
  if (!sku) throw new Error('Magento: sku is required');
  const product: Record<string, unknown> = {
    sku,
    ...parseJsonObject(ctx.options.extra, 'extra'),
  };
  const name = asString(ctx.options.name);
  if (name) product.name = name;
  if (ctx.options.price !== undefined && asString(ctx.options.price) !== '') {
    product.price = Number(asString(ctx.options.price));
  }
  if (ctx.options.status !== undefined && asString(ctx.options.status) !== '') {
    product.status = Number(asString(ctx.options.status));
  }
  if (asBoolean(ctx.options.saveOptions)) (product as Record<string, unknown>).save_options = true;
  const data = await magentoApi(ctx, 'PUT', `/products/${encodeURIComponent(sku)}`, { product });
  return { outputs: { product: data, sku }, logs: [`Magento product update → ${sku}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const searchFields = [
  {
    id: 'filterJson',
    label: 'Filter (JSON, advanced)',
    type: 'json' as const,
    helperText:
      'Magento searchCriteria payload. Leave empty to return the first page. See https://devdocs.magento.com/guides/v2.4/rest/performing-searches.html',
  },
  {
    id: 'limit',
    label: 'Page size',
    type: 'number' as const,
    defaultValue: '50',
    helperText: 'Magento page_size (max 200).',
  },
];

const block: ForgeBlock = {
  id: 'forge_magento',
  name: 'Magento 2',
  description: 'Magento 2 customers, orders, products and invoices.',
  iconName: 'LuShoppingBag',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'magento',
  },
  actions: [
    {
      id: 'customer_create',
      label: 'Create customer',
      description: 'Create a customer.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstname', label: 'First name', type: 'text', required: true },
        { id: 'lastname', label: 'Last name', type: 'text', required: true },
        { id: 'password', label: 'Password', type: 'password' },
        { id: 'extra', label: 'Extra customer JSON (advanced)', type: 'json' },
      ],
      run: customerCreate,
    },
    {
      id: 'customer_delete',
      label: 'Delete customer',
      description: 'Delete a customer by id.',
      fields: [{ id: 'customerId', label: 'Customer ID', type: 'text', required: true }],
      run: customerDelete,
    },
    {
      id: 'customer_get',
      label: 'Get customer',
      description: 'Fetch a customer by id.',
      fields: [{ id: 'customerId', label: 'Customer ID', type: 'text', required: true }],
      run: customerGet,
    },
    {
      id: 'customer_getAll',
      label: 'List customers',
      description: 'Search customers via Magento searchCriteria.',
      fields: searchFields,
      run: customerGetAll,
    },
    {
      id: 'customer_update',
      label: 'Update customer',
      description: 'Update a customer by id.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'firstname', label: 'First name', type: 'text' },
        { id: 'lastname', label: 'Last name', type: 'text' },
        { id: 'password', label: 'New password', type: 'password' },
        { id: 'extra', label: 'Extra customer JSON (advanced)', type: 'json' },
      ],
      run: customerUpdate,
    },
    {
      id: 'invoice_create',
      label: 'Create invoice',
      description: 'Invoice an order.',
      fields: [{ id: 'orderId', label: 'Order ID', type: 'text', required: true }],
      run: invoiceCreate,
    },
    {
      id: 'order_cancel',
      label: 'Cancel order',
      description: 'Cancel an order.',
      fields: [{ id: 'orderId', label: 'Order ID', type: 'text', required: true }],
      run: orderCancel,
    },
    {
      id: 'order_get',
      label: 'Get order',
      description: 'Fetch a Magento order by entity id.',
      fields: [{ id: 'orderId', label: 'Order ID', type: 'text', required: true }],
      run: orderGet,
    },
    {
      id: 'order_getAll',
      label: 'List orders',
      description: 'Search orders via Magento searchCriteria.',
      fields: searchFields,
      run: orderGetAll,
    },
    {
      id: 'order_ship',
      label: 'Ship order',
      description: 'Create a shipment for an order.',
      fields: [{ id: 'orderId', label: 'Order ID', type: 'text', required: true }],
      run: orderShip,
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
      id: 'product_delete',
      label: 'Delete product',
      description: 'Delete a product by SKU.',
      fields: [{ id: 'sku', label: 'SKU', type: 'text', required: true }],
      run: productDelete,
    },
    {
      id: 'product_get',
      label: 'Get product',
      description: 'Fetch a product by SKU.',
      fields: [{ id: 'sku', label: 'SKU', type: 'text', required: true }],
      run: productGet,
    },
    {
      id: 'product_getAll',
      label: 'List products',
      description: 'Search products via Magento searchCriteria.',
      fields: searchFields,
      run: productGetAll,
    },
    {
      id: 'product_update',
      label: 'Update product',
      description: 'Update a product by SKU.',
      fields: [
        { id: 'sku', label: 'SKU', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'price', label: 'Price', type: 'number' },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Enabled', value: '1' },
            { label: 'Disabled', value: '2' },
          ],
        },
        { id: 'saveOptions', label: 'Save options', type: 'toggle' },
        { id: 'extra', label: 'Extra product JSON (advanced)', type: 'json' },
      ],
      run: productUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
