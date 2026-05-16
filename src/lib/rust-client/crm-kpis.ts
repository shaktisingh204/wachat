import 'server-only';

/**
 * CRM KPIs client — wraps `/v1/crm/kpis`.
 */
import { rustFetch } from './fetcher';

export type CrmKpiStatus = 'active' | 'archived';

export type CrmKpiFrequency = 'monthly' | 'quarterly' | 'annual';

export interface CrmKpiDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  target?: string;
  unit?: string;
  frequency?: CrmKpiFrequency | string;
  owner?: string;
  department?: string;
  weight?: number;
  category?: string;
  status: CrmKpiStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmKpiListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmKpiStatus | 'all';
  frequency?: CrmKpiFrequency | string;
  department?: string;
  owner?: string;
  category?: string;
}

export interface CrmKpiListResponse {
  items: CrmKpiDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmKpiCreateInput {
  name: string;
  description?: string;
  target?: string;
  unit?: string;
  frequency?: CrmKpiFrequency | string;
  owner?: string;
  department?: string;
  weight?: number;
  category?: string;
}

export type CrmKpiUpdateInput = Partial<CrmKpiCreateInput> & {
  status?: CrmKpiStatus;
};

function buildListQuery(p?: CrmKpiListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.frequency) qs.set('frequency', p.frequency);
  if (p.department) qs.set('department', p.department);
  if (p.owner) qs.set('owner', p.owner);
  if (p.category) qs.set('category', p.category);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmKpisApi = {
  list: (params?: CrmKpiListParams) =>
    rustFetch<CrmKpiListResponse>(`/v1/crm/kpis${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmKpiDoc>(`/v1/crm/kpis/${encodeURIComponent(id)}`),
  create: (input: CrmKpiCreateInput) =>
    rustFetch<{ id: string; entity: CrmKpiDoc }>('/v1/crm/kpis', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmKpiUpdateInput) =>
    rustFetch<CrmKpiDoc>(`/v1/crm/kpis/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/kpis/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
