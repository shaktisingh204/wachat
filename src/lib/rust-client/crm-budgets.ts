import 'server-only';

/**
 * CRM Budgets client — wraps `/v1/crm/budgets`.
 */
import { rustFetch } from './fetcher';

export type CrmBudgetStatus =
  | 'draft'
  | 'approved'
  | 'rejected'
  | 'locked'
  | 'archived';

export interface CrmBudgetDoc {
  _id: string;
  userId?: string;
  budgetHead: string;
  department?: string;
  projectId?: string;
  period?: string;
  plannedAmount: number;
  actualAmount?: number;
  currency?: string;
  status?: CrmBudgetStatus;
  locked?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  lockedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmBudgetListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmBudgetStatus | 'all';
  department?: string;
  period?: string;
}

export interface CrmBudgetListResponse {
  items: CrmBudgetDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmBudgetCreateInput {
  budgetHead: string;
  department?: string;
  projectId?: string;
  period?: string;
  plannedAmount: number;
  currency?: string;
  notes?: string;
}

export type CrmBudgetUpdateInput = Partial<CrmBudgetCreateInput> & {
  status?: CrmBudgetStatus;
  actualAmount?: number;
  locked?: boolean;
  rejectReason?: string;
};

function buildListQuery(p?: CrmBudgetListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.department) qs.set('department', p.department);
  if (p.period) qs.set('period', p.period);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmBudgetsApi = {
  list: (params?: CrmBudgetListParams) =>
    rustFetch<CrmBudgetListResponse>(`/v1/crm/budgets${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmBudgetDoc>(`/v1/crm/budgets/${encodeURIComponent(id)}`),
  create: (input: CrmBudgetCreateInput) =>
    rustFetch<{ id: string; entity: CrmBudgetDoc }>('/v1/crm/budgets', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmBudgetUpdateInput) =>
    rustFetch<CrmBudgetDoc>(`/v1/crm/budgets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/budgets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
