import 'server-only';

/**
 * CRM Petty Cash Float client — wraps `/v1/crm/petty-cash`.
 */
import { rustFetch } from './fetcher';

export type CrmPettyCashStatus = 'active' | 'closed' | 'archived';

export interface CrmPettyCashFloatDoc {
  _id: string;
  userId?: string;
  branchName?: string;
  custodianName?: string;
  custodianId?: string;
  openingBalance: number;
  currentBalance?: number;
  currency?: string;
  status?: CrmPettyCashStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPettyCashListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPettyCashStatus | 'all';
  branchName?: string;
}

export interface CrmPettyCashListResponse {
  items: CrmPettyCashFloatDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPettyCashCreateInput {
  branchName?: string;
  custodianName?: string;
  custodianId?: string;
  openingBalance: number;
  currency?: string;
  notes?: string;
}

export type CrmPettyCashUpdateInput = Partial<CrmPettyCashCreateInput> & {
  currentBalance?: number;
  status?: CrmPettyCashStatus;
};

function buildListQuery(p?: CrmPettyCashListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.branchName) qs.set('branchName', p.branchName);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPettyCashApi = {
  list: (params?: CrmPettyCashListParams) =>
    rustFetch<CrmPettyCashListResponse>(
      `/v1/crm/petty-cash${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPettyCashFloatDoc>(
      `/v1/crm/petty-cash/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPettyCashCreateInput) =>
    rustFetch<{ id: string; entity: CrmPettyCashFloatDoc }>('/v1/crm/petty-cash', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmPettyCashUpdateInput) =>
    rustFetch<CrmPettyCashFloatDoc>(
      `/v1/crm/petty-cash/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/petty-cash/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
