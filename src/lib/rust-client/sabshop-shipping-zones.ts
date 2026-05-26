import 'server-only';

/**
 * SabShop Shipping Zone client — wraps `/v1/sabshop/shipping-zones`.
 */
import { rustFetch } from './fetcher';

export interface SabshopShippingRate {
  name: string;
  kind: 'flat' | 'per_kg' | 'free';
  flatPrice?: number;
  perKg?: number;
  minTotal?: number;
}

export interface SabshopShippingZoneDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  name: string;
  regions: string[];
  rates: SabshopShippingRate[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabshopShippingZoneListResponse {
  items: SabshopShippingZoneDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabshopShippingZoneCreateInput {
  storefrontId: string;
  name: string;
  regions?: string[];
  rates?: SabshopShippingRate[];
  active?: boolean;
}

export type SabshopShippingZoneUpdateInput = Partial<Omit<SabshopShippingZoneCreateInput, 'storefrontId'>>;

export const sabshopShippingZonesApi = {
  list: (params?: { page?: number; limit?: number; storefrontId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.storefrontId) qs.set('storefrontId', params.storefrontId);
    const s = qs.toString();
    return rustFetch<SabshopShippingZoneListResponse>(
      `/v1/sabshop/shipping-zones${s ? `?${s}` : ''}`,
    );
  },
  getById: (id: string) =>
    rustFetch<SabshopShippingZoneDoc>(`/v1/sabshop/shipping-zones/${encodeURIComponent(id)}`),
  create: (input: SabshopShippingZoneCreateInput) =>
    rustFetch<{ id: string; entity: SabshopShippingZoneDoc }>(`/v1/sabshop/shipping-zones`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabshopShippingZoneUpdateInput) =>
    rustFetch<SabshopShippingZoneDoc>(`/v1/sabshop/shipping-zones/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabshop/shipping-zones/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
