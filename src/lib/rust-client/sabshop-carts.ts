import 'server-only';

/**
 * SabShop Cart client — wraps `/v1/sabshop/carts`.
 */
import { rustFetch } from './fetcher';

export interface SabshopCartLineItem {
  productId: string;
  variantId?: string;
  name: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface SabshopCartTotals {
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  total: number;
}

export interface SabshopCartDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  customerId?: string;
  guestSessionId?: string;
  lineItems: SabshopCartLineItem[];
  totals: SabshopCartTotals;
  currency?: string;
  couponCode?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabshopCartListResponse {
  items: SabshopCartDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabshopCartCreateInput {
  storefrontId: string;
  customerId?: string;
  guestSessionId?: string;
  lineItems?: SabshopCartLineItem[];
  currency?: string;
  couponCode?: string;
}

export interface SabshopCartUpdateInput {
  lineItems?: SabshopCartLineItem[];
  totals?: SabshopCartTotals;
  couponCode?: string;
  customerId?: string;
}

export const sabshopCartsApi = {
  list: (params?: { page?: number; limit?: number; storefrontId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.storefrontId) qs.set('storefrontId', params.storefrontId);
    const s = qs.toString();
    return rustFetch<SabshopCartListResponse>(`/v1/sabshop/carts${s ? `?${s}` : ''}`);
  },
  getById: (id: string) =>
    rustFetch<SabshopCartDoc>(`/v1/sabshop/carts/${encodeURIComponent(id)}`),
  create: (input: SabshopCartCreateInput) =>
    rustFetch<{ id: string; entity: SabshopCartDoc }>(`/v1/sabshop/carts`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabshopCartUpdateInput) =>
    rustFetch<SabshopCartDoc>(`/v1/sabshop/carts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabshop/carts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
