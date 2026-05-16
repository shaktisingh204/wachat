import 'server-only';

/**
 * CRM Product Categories client — wraps `/v1/crm/product-categories`.
 */
import { rustFetch } from './fetcher';

export type CrmProductCategoryStatus = 'active' | 'archived';

export interface CrmProductCategoryDoc {
  _id: string;
  userId?: string;
  name: string;
  slug?: string;
  parentId?: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  status: CrmProductCategoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProductCategoryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmProductCategoryStatus | 'all';
  parentId?: string;
  isActive?: boolean;
}

export interface CrmProductCategoryListResponse {
  items: CrmProductCategoryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmProductCategoryCreateInput {
  name: string;
  slug?: string;
  parentId?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export type CrmProductCategoryUpdateInput =
  Partial<CrmProductCategoryCreateInput> & {
    status?: CrmProductCategoryStatus;
  };

function buildListQuery(p?: CrmProductCategoryListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.parentId) qs.set('parentId', p.parentId);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmProductCategoriesApi = {
  list: (params?: CrmProductCategoryListParams) =>
    rustFetch<CrmProductCategoryListResponse>(
      `/v1/crm/product-categories${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmProductCategoryDoc>(
      `/v1/crm/product-categories/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmProductCategoryCreateInput) =>
    rustFetch<{ id: string; entity: CrmProductCategoryDoc }>(
      '/v1/crm/product-categories',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmProductCategoryUpdateInput) =>
    rustFetch<CrmProductCategoryDoc>(
      `/v1/crm/product-categories/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/product-categories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
