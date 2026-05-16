import 'server-only';

/**
 * CRM Brand client — wraps `/v1/crm/brands`.
 *
 * Counterpart of the Rust crate `crm-brands`. Foundational lookup entity
 * referenced by items/products.
 */
import { rustFetch } from './fetcher';

export interface CrmBrandDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'archived';
}

export interface CrmBrandListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'active' | 'archived' | 'all';
}

export interface CrmBrandListResponse {
  items: CrmBrandDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmBrandCreateInput {
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  color?: string;
}

export type CrmBrandUpdateInput = Partial<CrmBrandCreateInput> & {
  status?: 'active' | 'archived';
};

function buildListQuery(p?: CrmBrandListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmBrandsApi = {
  list: (params?: CrmBrandListParams) =>
    rustFetch<CrmBrandListResponse>(`/v1/crm/brands${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmBrandDoc>(`/v1/crm/brands/${encodeURIComponent(id)}`),
  create: (input: CrmBrandCreateInput) =>
    rustFetch<{ id: string; entity: CrmBrandDoc }>('/v1/crm/brands', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmBrandUpdateInput) =>
    rustFetch<CrmBrandDoc>(`/v1/crm/brands/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/brands/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
