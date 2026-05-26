import 'server-only';

/**
 * SabShop Collection client — wraps `/v1/sabshop/collections`.
 */
import { rustFetch } from './fetcher';

export interface SabshopCollectionDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  productIds?: string[];
  rules?: unknown;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabshopCollectionListResponse {
  items: SabshopCollectionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabshopCollectionCreateInput {
  storefrontId: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  productIds?: string[];
  rules?: unknown;
  published?: boolean;
}

export type SabshopCollectionUpdateInput = Partial<Omit<SabshopCollectionCreateInput, 'storefrontId'>>;

export const sabshopCollectionsApi = {
  list: (params?: { page?: number; limit?: number; q?: string; storefrontId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.q) qs.set('q', params.q);
    if (params?.storefrontId) qs.set('storefrontId', params.storefrontId);
    const s = qs.toString();
    return rustFetch<SabshopCollectionListResponse>(
      `/v1/sabshop/collections${s ? `?${s}` : ''}`,
    );
  },
  getById: (id: string) =>
    rustFetch<SabshopCollectionDoc>(`/v1/sabshop/collections/${encodeURIComponent(id)}`),
  create: (input: SabshopCollectionCreateInput) =>
    rustFetch<{ id: string; entity: SabshopCollectionDoc }>(`/v1/sabshop/collections`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabshopCollectionUpdateInput) =>
    rustFetch<SabshopCollectionDoc>(`/v1/sabshop/collections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabshop/collections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
