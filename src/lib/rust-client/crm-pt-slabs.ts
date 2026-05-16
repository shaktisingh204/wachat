import 'server-only';

/**
 * CRM Professional Tax Slabs client — wraps `/v1/crm/pt-slabs`.
 */
import { rustFetch } from './fetcher';

export type CrmPtSlabStatus = 'active' | 'archived';
export type CrmPtSlabGender = 'male' | 'female' | 'any';

export interface CrmPtSlabDoc {
  _id: string;
  userId?: string;
  state: string;
  gender?: CrmPtSlabGender;
  minAmount: number;
  maxAmount?: number;
  taxAmount: number;
  effectiveFrom?: string;
  notes?: string;
  status: CrmPtSlabStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPtSlabListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPtSlabStatus | 'all';
  state?: string;
  gender?: CrmPtSlabGender;
}

export interface CrmPtSlabListResponse {
  items: CrmPtSlabDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPtSlabCreateInput {
  state: string;
  gender?: CrmPtSlabGender;
  minAmount: number;
  maxAmount?: number;
  taxAmount: number;
  effectiveFrom?: string;
  notes?: string;
}

export type CrmPtSlabUpdateInput = Partial<CrmPtSlabCreateInput> & {
  status?: CrmPtSlabStatus;
};

function buildListQuery(p?: CrmPtSlabListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.state) qs.set('state', p.state);
  if (p.gender) qs.set('gender', p.gender);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPtSlabsApi = {
  list: (params?: CrmPtSlabListParams) =>
    rustFetch<CrmPtSlabListResponse>(
      `/v1/crm/pt-slabs${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPtSlabDoc>(
      `/v1/crm/pt-slabs/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPtSlabCreateInput) =>
    rustFetch<{ id: string; entity: CrmPtSlabDoc }>(
      '/v1/crm/pt-slabs',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmPtSlabUpdateInput) =>
    rustFetch<CrmPtSlabDoc>(
      `/v1/crm/pt-slabs/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/pt-slabs/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
