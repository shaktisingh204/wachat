import 'server-only';

/**
 * CRM Product client — wraps `/v1/crm/products` on the Rust BFF.
 *
 * This is the **simplified Product** surface (collection `crm_products`,
 * entity `product`). It is intentionally separate from `crm-items.ts`
 * which serves the richer `/v1/crm/items` shape over the same collection.
 *
 * Mirrors the Rust DTO in `rust/crates/crm-products/src/types.rs`. Keep
 * the two in lock-step.
 */

import { rustFetch } from './fetcher';

export type CrmProductStatus = 'active' | 'inactive' | 'archived';

export interface CrmProductDoc {
  _id: string;
  userId?: string;
  name: string;
  sku?: string;
  category?: string;
  brand?: string;
  unit?: string;
  buyPrice?: number;
  sellPrice: number;
  taxRate?: number;
  stock?: number;
  reorderLevel?: number;
  images?: string[];
  notes?: string;
  status: CrmProductStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProductListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmProductStatus | 'all';
  category?: string;
  brand?: string;
}

export interface CrmProductListResponse {
  items: CrmProductDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmProductCreateInput {
  name: string;
  sku?: string;
  category?: string;
  brand?: string;
  unit?: string;
  buyPrice?: number;
  sellPrice?: number;
  taxRate?: number;
  stock?: number;
  reorderLevel?: number;
  images?: string[];
  notes?: string;
  status?: CrmProductStatus;
}

export type CrmProductUpdateInput = Partial<CrmProductCreateInput>;

function buildListQuery(p?: CrmProductListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  if (p.brand) qs.set('brand', p.brand);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmProductsApi = {
  list: (params?: CrmProductListParams) =>
    rustFetch<CrmProductListResponse>(
      `/v1/crm/products${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmProductDoc>(
      `/v1/crm/products/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmProductCreateInput) =>
    rustFetch<{ id: string; entity: CrmProductDoc }>(
      '/v1/crm/products',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmProductUpdateInput) =>
    rustFetch<CrmProductDoc>(
      `/v1/crm/products/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/products/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
