import 'server-only';

/**
 * CRM Task Category client — wraps `/v1/crm/task-categories`.
 *
 * Hierarchical: each category may have an optional `parentId`. List
 * supports filtering by parent — pass `parentId: 'root'` to fetch only
 * top-level categories (i.e. those with null parent).
 */
import { rustFetch } from './fetcher';

export type CrmTaskCategoryStatus = 'active' | 'archived';

export interface CrmTaskCategoryDoc {
  _id: string;
  userId?: string;
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  status: CrmTaskCategoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTaskCategoryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTaskCategoryStatus | 'all';
  /** Use `'root'` to filter to top-level (parentless) categories. */
  parentId?: string | 'root';
  isActive?: boolean;
}

export interface CrmTaskCategoryListResponse {
  items: CrmTaskCategoryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTaskCategoryCreateInput {
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export type CrmTaskCategoryUpdateInput = Partial<CrmTaskCategoryCreateInput> & {
  status?: CrmTaskCategoryStatus;
};

function buildListQuery(p?: CrmTaskCategoryListParams): string {
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

export const crmTaskCategoriesApi = {
  list: (params?: CrmTaskCategoryListParams) =>
    rustFetch<CrmTaskCategoryListResponse>(
      `/v1/crm/task-categories${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTaskCategoryDoc>(
      `/v1/crm/task-categories/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTaskCategoryCreateInput) =>
    rustFetch<{ id: string; entity: CrmTaskCategoryDoc }>(
      '/v1/crm/task-categories',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: CrmTaskCategoryUpdateInput) =>
    rustFetch<CrmTaskCategoryDoc>(
      `/v1/crm/task-categories/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/task-categories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
