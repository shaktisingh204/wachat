import 'server-only';

/**
 * CRM Online-Store client — wraps `/v1/crm/store`.
 *
 * Mirrors the six collections defined in
 * `rust/crates/crm-store/src/types.rs`:
 *   - storefronts, products, pricingRules, shippingZones, orders,
 *     abandonedCarts.
 *
 * The TS server actions in `src/app/actions/crm-store.actions.ts` go
 * Mongo-direct today; this client exists so the swap to the Rust BFF
 * is a one-line flag flip when the dual-impl wiring lands.
 */
import { rustFetch } from './fetcher';

/* ─── Shared sub-types ───────────────────────────────────────────────── */

export interface CrmStoreHomepageBlock {
  kind: 'hero' | 'featured' | 'categories' | 'banner' | string;
  config?: unknown;
}

export interface CrmStorePricingCondition {
  kind: 'min_subtotal' | 'product_ids' | 'category_ids' | 'tag' | string;
  value: unknown;
}

export interface CrmStorePricingApplies {
  kind: 'all' | 'products' | 'categories';
  refs?: string[];
}

export interface CrmStoreShippingMethod {
  name: string;
  kind: 'flat' | 'weight_based' | 'free_above';
  rate: number;
  freeAboveSubtotal?: number | null;
}

export interface CrmStoreOrderLineItem {
  productId: string;
  sku: string;
  title: string;
  quantity: number;
  price: number;
  total: number;
}

export interface CrmStoreAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/* ─── Storefronts ────────────────────────────────────────────────────── */

export type CrmStorefrontStatus = 'draft' | 'published' | 'archived';

export interface CrmStorefrontDoc {
  _id: string;
  userId?: string;
  name: string;
  slug: string;
  domain?: string | null;
  currency: string;
  themeId?: string | null;
  logoUrl?: string | null;
  homepageBlocks?: CrmStoreHomepageBlock[];
  status: CrmStorefrontStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmStorefrontListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmStorefrontStatus | 'all';
}

export interface CrmStorefrontListResponse {
  items: CrmStorefrontDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmStorefrontCreateInput {
  name: string;
  slug: string;
  domain?: string;
  currency: string;
  themeId?: string;
  logoUrl?: string;
  homepageBlocks?: CrmStoreHomepageBlock[];
}

export type CrmStorefrontUpdateInput = Partial<CrmStorefrontCreateInput> & {
  status?: CrmStorefrontStatus;
};

/* ─── Store products ─────────────────────────────────────────────────── */

export type CrmStoreProductStatus = 'draft' | 'active' | 'archived';
export type CrmStoreStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface CrmStoreProductDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  itemId: string;
  sku: string;
  title: string;
  description?: string | null;
  images?: string[];
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  inventoryTracked: boolean;
  stockStatus: CrmStoreStockStatus;
  categoryIds?: string[];
  tags?: string[];
  status: CrmStoreProductStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmStoreProductListParams {
  page?: number;
  limit?: number;
  q?: string;
  storefrontId?: string;
  status?: CrmStoreProductStatus | 'all';
}

export interface CrmStoreProductListResponse {
  items: CrmStoreProductDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmStoreProductCreateInput {
  storefrontId: string;
  itemId: string;
  sku: string;
  title: string;
  description?: string;
  images?: string[];
  price: number;
  compareAtPrice?: number;
  currency: string;
  inventoryTracked?: boolean;
  stockStatus?: CrmStoreStockStatus;
  categoryIds?: string[];
  tags?: string[];
}

export type CrmStoreProductUpdateInput = Partial<CrmStoreProductCreateInput> & {
  status?: CrmStoreProductStatus;
};

/* ─── Pricing rules ──────────────────────────────────────────────────── */

export type CrmStorePricingRuleKind =
  | 'percent_off'
  | 'fixed_off'
  | 'buy_x_get_y'
  | 'bundle';
export type CrmStorePricingRuleStatus = 'active' | 'paused' | 'archived';

export interface CrmStorePricingRuleDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  name: string;
  kind: CrmStorePricingRuleKind;
  conditions?: CrmStorePricingCondition[];
  applies: CrmStorePricingApplies;
  value: number;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  status: CrmStorePricingRuleStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmStorePricingRuleListParams {
  page?: number;
  limit?: number;
  storefrontId?: string;
  status?: CrmStorePricingRuleStatus | 'all';
}

export interface CrmStorePricingRuleListResponse {
  items: CrmStorePricingRuleDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmStorePricingRuleCreateInput {
  storefrontId: string;
  name: string;
  kind: CrmStorePricingRuleKind;
  conditions?: CrmStorePricingCondition[];
  applies: CrmStorePricingApplies;
  value: number;
  priority?: number;
  startsAt?: string;
  endsAt?: string;
}

export type CrmStorePricingRuleUpdateInput =
  Partial<CrmStorePricingRuleCreateInput> & {
    status?: CrmStorePricingRuleStatus;
  };

/* ─── Shipping zones ─────────────────────────────────────────────────── */

export type CrmStoreShippingZoneStatus = 'active' | 'paused' | 'archived';

export interface CrmStoreShippingZoneDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  name: string;
  countries?: string[];
  states?: string[] | null;
  methods?: CrmStoreShippingMethod[];
  status: CrmStoreShippingZoneStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmStoreShippingZoneListParams {
  page?: number;
  limit?: number;
  storefrontId?: string;
  status?: CrmStoreShippingZoneStatus | 'all';
}

export interface CrmStoreShippingZoneListResponse {
  items: CrmStoreShippingZoneDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmStoreShippingZoneCreateInput {
  storefrontId: string;
  name: string;
  countries: string[];
  states?: string[];
  methods: CrmStoreShippingMethod[];
}

export type CrmStoreShippingZoneUpdateInput =
  Partial<CrmStoreShippingZoneCreateInput> & {
    status?: CrmStoreShippingZoneStatus;
  };

/* ─── Orders ─────────────────────────────────────────────────────────── */

export type CrmStoreOrderPaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';
export type CrmStoreOrderFulfillmentStatus =
  | 'unfulfilled'
  | 'partial'
  | 'fulfilled'
  | 'cancelled';

export interface CrmStoreOrderDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  shippingAddress: CrmStoreAddress;
  billingAddress?: CrmStoreAddress | null;
  lineItems: CrmStoreOrderLineItem[];
  subtotal: number;
  discount?: number | null;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  paymentStatus: CrmStoreOrderPaymentStatus;
  paymentMethod: string;
  paymentRef?: string | null;
  fulfillmentStatus: CrmStoreOrderFulfillmentStatus;
  placedAt: string;
  linkedInvoiceId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmStoreOrderListParams {
  page?: number;
  limit?: number;
  storefrontId?: string;
  paymentStatus?: CrmStoreOrderPaymentStatus | 'all';
  fulfillmentStatus?: CrmStoreOrderFulfillmentStatus | 'all';
}

export interface CrmStoreOrderListResponse {
  items: CrmStoreOrderDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmStoreOrderCreateInput {
  storefrontId: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress: CrmStoreAddress;
  billingAddress?: CrmStoreAddress;
  lineItems: CrmStoreOrderLineItem[];
  subtotal: number;
  discount?: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentRef?: string;
}

export type CrmStoreOrderUpdateInput = Partial<CrmStoreOrderCreateInput> & {
  paymentStatus?: CrmStoreOrderPaymentStatus;
  fulfillmentStatus?: CrmStoreOrderFulfillmentStatus;
};

/* ─── Abandoned carts ────────────────────────────────────────────────── */

export interface CrmStoreAbandonedCartDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  customerEmail: string;
  customerName?: string | null;
  lineItems: CrmStoreOrderLineItem[];
  subtotal: number;
  currency: string;
  lastInteractionAt: string;
  recoveryEmailSentAt?: string | null;
  recovered?: boolean | null;
  recoveredOrderId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmStoreAbandonedCartListParams {
  page?: number;
  limit?: number;
  storefrontId?: string;
  recovered?: boolean;
}

export interface CrmStoreAbandonedCartListResponse {
  items: CrmStoreAbandonedCartDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmStoreAbandonedCartTrackInput {
  storefrontId: string;
  customerEmail: string;
  customerName?: string;
  lineItems: CrmStoreOrderLineItem[];
  subtotal: number;
  currency: string;
}

/* ─── Query helpers ──────────────────────────────────────────────────── */

function qs(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/* ─── Public API surface ─────────────────────────────────────────────── */

export const crmStoreApi = {
  storefronts: {
    list: (params?: CrmStorefrontListParams) =>
      rustFetch<CrmStorefrontListResponse>(
        `/v1/crm/store/storefronts${qs(params as Record<string, unknown>)}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmStorefrontDoc>(
        `/v1/crm/store/storefronts/${encodeURIComponent(id)}`,
      ),
    create: (input: CrmStorefrontCreateInput) =>
      rustFetch<{ id: string; entity: CrmStorefrontDoc }>(
        '/v1/crm/store/storefronts',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    update: (id: string, patch: CrmStorefrontUpdateInput) =>
      rustFetch<CrmStorefrontDoc>(
        `/v1/crm/store/storefronts/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    archive: (id: string) =>
      rustFetch<{ deleted: boolean }>(
        `/v1/crm/store/storefronts/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
  },
  products: {
    list: (params?: CrmStoreProductListParams) =>
      rustFetch<CrmStoreProductListResponse>(
        `/v1/crm/store/products${qs(params as Record<string, unknown>)}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmStoreProductDoc>(
        `/v1/crm/store/products/${encodeURIComponent(id)}`,
      ),
    create: (input: CrmStoreProductCreateInput) =>
      rustFetch<{ id: string; entity: CrmStoreProductDoc }>(
        '/v1/crm/store/products',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    update: (id: string, patch: CrmStoreProductUpdateInput) =>
      rustFetch<CrmStoreProductDoc>(
        `/v1/crm/store/products/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    archive: (id: string) =>
      rustFetch<{ deleted: boolean }>(
        `/v1/crm/store/products/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
  },
  pricingRules: {
    list: (params?: CrmStorePricingRuleListParams) =>
      rustFetch<CrmStorePricingRuleListResponse>(
        `/v1/crm/store/pricing-rules${qs(params as Record<string, unknown>)}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmStorePricingRuleDoc>(
        `/v1/crm/store/pricing-rules/${encodeURIComponent(id)}`,
      ),
    create: (input: CrmStorePricingRuleCreateInput) =>
      rustFetch<{ id: string; entity: CrmStorePricingRuleDoc }>(
        '/v1/crm/store/pricing-rules',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    update: (id: string, patch: CrmStorePricingRuleUpdateInput) =>
      rustFetch<CrmStorePricingRuleDoc>(
        `/v1/crm/store/pricing-rules/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    archive: (id: string) =>
      rustFetch<{ deleted: boolean }>(
        `/v1/crm/store/pricing-rules/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
  },
  shippingZones: {
    list: (params?: CrmStoreShippingZoneListParams) =>
      rustFetch<CrmStoreShippingZoneListResponse>(
        `/v1/crm/store/shipping-zones${qs(params as Record<string, unknown>)}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmStoreShippingZoneDoc>(
        `/v1/crm/store/shipping-zones/${encodeURIComponent(id)}`,
      ),
    create: (input: CrmStoreShippingZoneCreateInput) =>
      rustFetch<{ id: string; entity: CrmStoreShippingZoneDoc }>(
        '/v1/crm/store/shipping-zones',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    update: (id: string, patch: CrmStoreShippingZoneUpdateInput) =>
      rustFetch<CrmStoreShippingZoneDoc>(
        `/v1/crm/store/shipping-zones/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    archive: (id: string) =>
      rustFetch<{ deleted: boolean }>(
        `/v1/crm/store/shipping-zones/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
  },
  orders: {
    list: (params?: CrmStoreOrderListParams) =>
      rustFetch<CrmStoreOrderListResponse>(
        `/v1/crm/store/orders${qs(params as Record<string, unknown>)}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmStoreOrderDoc>(
        `/v1/crm/store/orders/${encodeURIComponent(id)}`,
      ),
    create: (input: CrmStoreOrderCreateInput) =>
      rustFetch<{ id: string; entity: CrmStoreOrderDoc }>(
        '/v1/crm/store/orders',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    update: (id: string, patch: CrmStoreOrderUpdateInput) =>
      rustFetch<CrmStoreOrderDoc>(
        `/v1/crm/store/orders/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    archive: (id: string) =>
      rustFetch<{ deleted: boolean }>(
        `/v1/crm/store/orders/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
    markPaid: (id: string) =>
      rustFetch<CrmStoreOrderDoc>(
        `/v1/crm/store/orders/${encodeURIComponent(id)}/mark-paid`,
        { method: 'POST' },
      ),
    markFulfilled: (id: string) =>
      rustFetch<CrmStoreOrderDoc>(
        `/v1/crm/store/orders/${encodeURIComponent(id)}/mark-fulfilled`,
        { method: 'POST' },
      ),
  },
  abandonedCarts: {
    list: (params?: CrmStoreAbandonedCartListParams) =>
      rustFetch<CrmStoreAbandonedCartListResponse>(
        `/v1/crm/store/abandoned-carts${qs(
          params as Record<string, unknown>,
        )}`,
      ),
    getById: (id: string) =>
      rustFetch<CrmStoreAbandonedCartDoc>(
        `/v1/crm/store/abandoned-carts/${encodeURIComponent(id)}`,
      ),
    track: (input: CrmStoreAbandonedCartTrackInput) =>
      rustFetch<{ id: string; entity: CrmStoreAbandonedCartDoc }>(
        '/v1/crm/store/abandoned-carts/track',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    delete: (id: string) =>
      rustFetch<{ deleted: boolean }>(
        `/v1/crm/store/abandoned-carts/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
    markRecovered: (id: string, orderId?: string) =>
      rustFetch<CrmStoreAbandonedCartDoc>(
        `/v1/crm/store/abandoned-carts/${encodeURIComponent(id)}/recover`,
        { method: 'POST', body: JSON.stringify({ orderId }) },
      ),
  },
};
