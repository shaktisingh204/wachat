import 'server-only';

/**
 * CRM Loans client — wraps `/v1/crm/loans`.
 */
import { rustFetch } from './fetcher';

export type CrmLoanDirection = 'taken' | 'given';
export type CrmLoanStatus = 'active' | 'closed' | 'defaulted' | 'archived';

export interface CrmLoanDoc {
  _id: string;
  userId?: string;
  partyName: string;
  direction?: CrmLoanDirection;
  principal: number;
  currency?: string;
  interestRate?: number;
  tenureMonths?: number;
  startDate?: string;
  emi?: number;
  outstanding?: number;
  paid?: number;
  status?: CrmLoanStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmLoanListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmLoanStatus | 'all';
  direction?: CrmLoanDirection;
}

export interface CrmLoanListResponse {
  items: CrmLoanDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmLoanCreateInput {
  partyName: string;
  direction?: CrmLoanDirection;
  principal: number;
  currency?: string;
  interestRate?: number;
  tenureMonths?: number;
  startDate?: string;
  emi?: number;
  notes?: string;
}

export type CrmLoanUpdateInput = Partial<CrmLoanCreateInput> & {
  status?: CrmLoanStatus;
  outstanding?: number;
  paid?: number;
};

function buildListQuery(p?: CrmLoanListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.direction) qs.set('direction', p.direction);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmLoansApi = {
  list: (params?: CrmLoanListParams) =>
    rustFetch<CrmLoanListResponse>(`/v1/crm/loans${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmLoanDoc>(`/v1/crm/loans/${encodeURIComponent(id)}`),
  create: (input: CrmLoanCreateInput) =>
    rustFetch<{ id: string; entity: CrmLoanDoc }>('/v1/crm/loans', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmLoanUpdateInput) =>
    rustFetch<CrmLoanDoc>(`/v1/crm/loans/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/loans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
