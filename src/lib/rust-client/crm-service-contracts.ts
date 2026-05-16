import 'server-only';

/**
 * CRM Service Contract client — wraps `/v1/crm/service-contracts`.
 */
import { rustFetch } from './fetcher';

export type CrmServiceContractStatus =
  | 'active'
  | 'paused'
  | 'expired'
  | 'renewed'
  | 'archived';

export interface CrmServiceVisit {
  _id?: string;
  date: string;
  technician?: string;
  status?: 'scheduled' | 'completed' | 'missed';
  createdAt?: string;
}

export interface CrmServiceContractDoc {
  _id: string;
  userId?: string;
  contractNo: string;
  customerId?: string;
  customerName: string;
  assetName?: string;
  coverage?: string;
  frequency?: string;
  periodStart?: string;
  periodEnd?: string;
  billingAmount: number;
  technician?: string;
  notes?: string;
  status?: CrmServiceContractStatus;
  visits?: CrmServiceVisit[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmServiceContractListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmServiceContractStatus | 'all';
  customerId?: string;
}

export interface CrmServiceContractListResponse {
  items: CrmServiceContractDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmServiceContractCreateInput {
  contractNo?: string;
  customerId?: string;
  customerName: string;
  assetName?: string;
  coverage?: string;
  frequency?: string;
  periodStart?: string;
  periodEnd?: string;
  billingAmount?: number;
  technician?: string;
  notes?: string;
}

export type CrmServiceContractUpdateInput =
  Partial<CrmServiceContractCreateInput> & {
    status?: CrmServiceContractStatus;
  };

function buildListQuery(p?: CrmServiceContractListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.customerId) qs.set('customerId', p.customerId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmServiceContractsApi = {
  list: (params?: CrmServiceContractListParams) =>
    rustFetch<CrmServiceContractListResponse>(
      `/v1/crm/service-contracts${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmServiceContractDoc>(
      `/v1/crm/service-contracts/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmServiceContractCreateInput) =>
    rustFetch<{ id: string; entity: CrmServiceContractDoc }>(
      '/v1/crm/service-contracts',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmServiceContractUpdateInput) =>
    rustFetch<CrmServiceContractDoc>(
      `/v1/crm/service-contracts/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/service-contracts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
