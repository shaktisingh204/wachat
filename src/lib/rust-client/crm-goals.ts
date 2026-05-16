import 'server-only';

/**
 * CRM Goals client — wraps `/v1/crm/goals`.
 */
import { rustFetch } from './fetcher';

export type CrmGoalStatus =
  | 'draft'
  | 'active'
  | 'achieved'
  | 'missed'
  | 'archived';

export interface CrmGoalDoc {
  _id: string;
  userId?: string;
  title: string;
  description?: string;
  employeeId?: string;
  employeeName?: string;
  period?: string;
  target?: string;
  achieved?: string;
  progress?: number;
  weight?: number;
  kpi?: string;
  status: CrmGoalStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmGoalListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmGoalStatus | 'all';
  employeeId?: string;
  period?: string;
}

export interface CrmGoalListResponse {
  items: CrmGoalDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmGoalCreateInput {
  title: string;
  description?: string;
  employeeId?: string;
  employeeName?: string;
  period?: string;
  target?: string;
  achieved?: string;
  progress?: number;
  weight?: number;
  kpi?: string;
  status?: CrmGoalStatus;
}

export type CrmGoalUpdateInput = Partial<CrmGoalCreateInput>;

function buildListQuery(p?: CrmGoalListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  if (p.period) qs.set('period', p.period);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmGoalsApi = {
  list: (params?: CrmGoalListParams) =>
    rustFetch<CrmGoalListResponse>(`/v1/crm/goals${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmGoalDoc>(`/v1/crm/goals/${encodeURIComponent(id)}`),
  create: (input: CrmGoalCreateInput) =>
    rustFetch<{ id: string; entity: CrmGoalDoc }>('/v1/crm/goals', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmGoalUpdateInput) =>
    rustFetch<CrmGoalDoc>(`/v1/crm/goals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/goals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
