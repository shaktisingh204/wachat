import 'server-only';

/**
 * SabShop Checkout client — wraps `/v1/sabshop/checkouts`.
 */
import { rustFetch } from './fetcher';

export type SabshopCheckoutStep =
  | 'address'
  | 'shipping'
  | 'payment'
  | 'review'
  | 'completed';

export interface SabshopCheckoutDoc {
  _id: string;
  userId?: string;
  cartId: string;
  storefrontId: string;
  step: SabshopCheckoutStep;
  payload?: unknown;
  orderId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabshopCheckoutListResponse {
  items: SabshopCheckoutDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabshopCheckoutCreateInput {
  cartId: string;
  storefrontId: string;
  step?: SabshopCheckoutStep;
  payload?: unknown;
}

export interface SabshopCheckoutUpdateInput {
  step?: SabshopCheckoutStep;
  payload?: unknown;
  orderId?: string;
}

export const sabshopCheckoutsApi = {
  list: (params?: { page?: number; limit?: number; storefrontId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.storefrontId) qs.set('storefrontId', params.storefrontId);
    const s = qs.toString();
    return rustFetch<SabshopCheckoutListResponse>(
      `/v1/sabshop/checkouts${s ? `?${s}` : ''}`,
    );
  },
  getById: (id: string) =>
    rustFetch<SabshopCheckoutDoc>(`/v1/sabshop/checkouts/${encodeURIComponent(id)}`),
  create: (input: SabshopCheckoutCreateInput) =>
    rustFetch<{ id: string; entity: SabshopCheckoutDoc }>(`/v1/sabshop/checkouts`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabshopCheckoutUpdateInput) =>
    rustFetch<SabshopCheckoutDoc>(`/v1/sabshop/checkouts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabshop/checkouts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
