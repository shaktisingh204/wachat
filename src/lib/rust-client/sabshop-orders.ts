import 'server-only';

/**
 * SabShop Order client — wraps `/v1/sabshop/orders`.
 */
import { rustFetch } from './fetcher';

export type SabshopPaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';
export type SabshopFulfillmentStatus =
  | 'unfulfilled'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface SabshopOrderLineItem {
  productId: string;
  variantId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface SabshopOrderTotals {
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  total: number;
}

export interface SabshopOrderAddress {
  name?: string;
  email?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface SabshopOrderDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  orderCode: string;
  customerId?: string;
  lineItems: SabshopOrderLineItem[];
  totals: SabshopOrderTotals;
  paymentStatus: SabshopPaymentStatus;
  fulfillmentStatus: SabshopFulfillmentStatus;
  shippingAddress?: SabshopOrderAddress;
  billingAddress?: SabshopOrderAddress;
  paymentRef?: string;
  paymentProvider?: string;
  currency?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabshopOrderListResponse {
  items: SabshopOrderDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabshopOrderCreateInput {
  storefrontId: string;
  customerId?: string;
  lineItems: SabshopOrderLineItem[];
  totals: SabshopOrderTotals;
  shippingAddress?: SabshopOrderAddress;
  billingAddress?: SabshopOrderAddress;
  paymentRef?: string;
  paymentProvider?: string;
  currency?: string;
  notes?: string;
}

export interface SabshopOrderUpdateInput {
  paymentStatus?: SabshopPaymentStatus;
  fulfillmentStatus?: SabshopFulfillmentStatus;
  paymentRef?: string;
  shippingAddress?: SabshopOrderAddress;
  billingAddress?: SabshopOrderAddress;
  notes?: string;
}

export const sabshopOrdersApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    q?: string;
    storefrontId?: string;
    paymentStatus?: SabshopPaymentStatus;
    fulfillmentStatus?: SabshopFulfillmentStatus;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.q) qs.set('q', params.q);
    if (params?.storefrontId) qs.set('storefrontId', params.storefrontId);
    if (params?.paymentStatus) qs.set('paymentStatus', params.paymentStatus);
    if (params?.fulfillmentStatus) qs.set('fulfillmentStatus', params.fulfillmentStatus);
    const s = qs.toString();
    return rustFetch<SabshopOrderListResponse>(`/v1/sabshop/orders${s ? `?${s}` : ''}`);
  },
  getById: (id: string) =>
    rustFetch<SabshopOrderDoc>(`/v1/sabshop/orders/${encodeURIComponent(id)}`),
  create: (input: SabshopOrderCreateInput) =>
    rustFetch<{ id: string; entity: SabshopOrderDoc }>(`/v1/sabshop/orders`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabshopOrderUpdateInput) =>
    rustFetch<SabshopOrderDoc>(`/v1/sabshop/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabshop/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
