import 'server-only';

/**
 * CRM Project Categories client — wraps `/v1/crm/project-categories`.
 *
 * Project Category is the categorization master for projects. Names are
 * unique per tenant (excluding archived rows). List is sorted by
 * `displayOrder` ASC, then name ASC.
 */
import { rustFetch } from './fetcher';

export type CrmProjectCategoryStatus = 'active' | 'archived';

export interface CrmProjectCategoryDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  color?: string;
  icon?: string;
  description?: string;
  parentId?: string;
  displayOrder: number;
  isActive: boolean;
  projectsCount: number;
  status: CrmProjectCategoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProjectCategoryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmProjectCategoryStatus | 'all';
  isActive?: boolean;
  /** Hex string, or `"null"` / `"none"` / `"root"` for top-level only. */
  parentId?: string;
}

export interface CrmProjectCategoryListResponse {
  items: CrmProjectCategoryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmProjectCategoryCreateInput {
  name: string;
  code?: string;
  color?: string;
  icon?: string;
  description?: string;
  parentId?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export type CrmProjectCategoryUpdateInput =
  Partial<CrmProjectCategoryCreateInput> & {
    status?: CrmProjectCategoryStatus;
  };

function buildListQuery(p?: CrmProjectCategoryListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  if (p.parentId) qs.set('parentId', p.parentId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmProjectCategoriesApi = {
  list: (params?: CrmProjectCategoryListParams) =>
    rustFetch<CrmProjectCategoryListResponse>(
      `/v1/crm/project-categories${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmProjectCategoryDoc>(
      `/v1/crm/project-categories/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmProjectCategoryCreateInput) =>
    rustFetch<{ id: string; entity: CrmProjectCategoryDoc }>(
      '/v1/crm/project-categories',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmProjectCategoryUpdateInput) =>
    rustFetch<CrmProjectCategoryDoc>(
      `/v1/crm/project-categories/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/project-categories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
