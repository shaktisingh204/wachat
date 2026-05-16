import 'server-only';

/**
 * CRM Expense Categories client — wraps `/v1/crm/expense-categories`.
 *
 * Expense classification master (W11). Each category is scoped to the tenant
 * (`userId`); name is unique among non-archived categories. Supports nested
 * categories via `parentId`, default GL account linkage, tax rate, billable /
 * reimbursable flags, per-expense ceilings, receipt thresholds, and visual
 * presentation (color, icon).
 */
import { rustFetch } from './fetcher';

export type CrmExpenseCategoryStatus = 'active' | 'archived';

export interface CrmExpenseCategoryDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  parentId?: string;
  description?: string;
  defaultAccountId?: string;
  taxRate?: number;
  isBillable: boolean;
  isReimbursable: boolean;
  maxAmount?: number;
  requiresReceiptAbove?: number;
  color?: string;
  icon?: string;
  isActive: boolean;
  status: CrmExpenseCategoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmExpenseCategoryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmExpenseCategoryStatus | 'all';
  isActive?: boolean;
  isBillable?: boolean;
  isReimbursable?: boolean;
  /** Pass `"none"` or `"null"` to filter to top-level categories. */
  parentId?: string;
}

export interface CrmExpenseCategoryListResponse {
  items: CrmExpenseCategoryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmExpenseCategoryCreateInput {
  name: string;
  code?: string;
  parentId?: string;
  description?: string;
  defaultAccountId?: string;
  taxRate?: number;
  isBillable?: boolean;
  isReimbursable?: boolean;
  maxAmount?: number;
  requiresReceiptAbove?: number;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export type CrmExpenseCategoryUpdateInput =
  Partial<CrmExpenseCategoryCreateInput> & {
    status?: CrmExpenseCategoryStatus;
  };

function buildListQuery(p?: CrmExpenseCategoryListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  if (p.isBillable != null) qs.set('isBillable', String(p.isBillable));
  if (p.isReimbursable != null)
    qs.set('isReimbursable', String(p.isReimbursable));
  if (p.parentId) qs.set('parentId', p.parentId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmExpenseCategoriesApi = {
  list: (params?: CrmExpenseCategoryListParams) =>
    rustFetch<CrmExpenseCategoryListResponse>(
      `/v1/crm/expense-categories${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmExpenseCategoryDoc>(
      `/v1/crm/expense-categories/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmExpenseCategoryCreateInput) =>
    rustFetch<{ id: string; entity: CrmExpenseCategoryDoc }>(
      '/v1/crm/expense-categories',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmExpenseCategoryUpdateInput) =>
    rustFetch<CrmExpenseCategoryDoc>(
      `/v1/crm/expense-categories/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/expense-categories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
