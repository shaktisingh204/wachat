import 'server-only';

/**
 * SabShop Storefront client — wraps `/v1/sabshop/storefronts`.
 * Counterpart of Rust crate `sabshop-storefronts`.
 */
import { rustFetch } from './fetcher';

export type SabshopStorefrontStatus = 'draft' | 'live' | 'paused';

export interface SabshopStorefrontDoc {
  _id: string;
  userId?: string;
  slug: string;
  displayName: string;
  description?: string;
  themeId?: string;
  currency: string;
  shippingZoneIds?: string[];
  taxRuleIds?: string[];
  status: SabshopStorefrontStatus;
  customCss?: string;
  logoUrl?: string;
  faviconUrl?: string;
  heroImageUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  featuredProductIds?: string[];
  featuredCollectionIds?: string[];
  publishedProductIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SabshopStorefrontListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabshopStorefrontStatus;
}

export interface SabshopStorefrontListResponse {
  items: SabshopStorefrontDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabshopStorefrontCreateInput {
  slug: string;
  displayName: string;
  description?: string;
  currency?: string;
  themeId?: string;
}

export type SabshopStorefrontUpdateInput = Partial<{
  slug: string;
  displayName: string;
  description: string;
  currency: string;
  themeId: string;
  status: SabshopStorefrontStatus;
  customCss: string;
  logoUrl: string;
  faviconUrl: string;
  heroImageUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  shippingZoneIds: string[];
  taxRuleIds: string[];
  featuredProductIds: string[];
  featuredCollectionIds: string[];
  publishedProductIds: string[];
}>;

function buildListQuery(p?: SabshopStorefrontListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabshopStorefrontsApi = {
  list: (params?: SabshopStorefrontListParams) =>
    rustFetch<SabshopStorefrontListResponse>(`/v1/sabshop/storefronts${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabshopStorefrontDoc>(`/v1/sabshop/storefronts/${encodeURIComponent(id)}`),
  create: (input: SabshopStorefrontCreateInput) =>
    rustFetch<{ id: string; entity: SabshopStorefrontDoc }>('/v1/sabshop/storefronts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabshopStorefrontUpdateInput) =>
    rustFetch<SabshopStorefrontDoc>(`/v1/sabshop/storefronts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabshop/storefronts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
