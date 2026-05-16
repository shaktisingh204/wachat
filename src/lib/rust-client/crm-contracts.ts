import 'server-only';

/**
 * CRM Contracts client — wraps `/v1/crm/contracts`.
 */
import { rustFetch } from './fetcher';

export type CrmContractStatus =
  | 'draft'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'archived';

export interface CrmContractDoc {
  _id: string;
  userId?: string;
  contractNo: string;
  title: string;
  partyName: string;
  type?: string;
  partyEmail?: string;
  partyPhone?: string;
  signatoryName?: string;
  signatoryEmail?: string;
  scope?: string;
  deliverables?: string;
  currency?: string;
  branch?: string;
  ownerId?: string;
  sourceProposalId?: string;
  sourceProposalNumber?: string;
  effectiveDate?: string;
  expiryDate?: string;
  autoRenew?: boolean;
  renewalNoticeDays?: number;
  value?: number;
  esignProvider?: string;
  notes?: string;
  attachments?: string[];
  status: CrmContractStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmContractListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmContractStatus | 'all';
  type?: string;
}

export interface CrmContractListResponse {
  items: CrmContractDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmContractCreateInput {
  contractNo?: string;
  title: string;
  partyName: string;
  type?: string;
  partyEmail?: string;
  partyPhone?: string;
  signatoryName?: string;
  signatoryEmail?: string;
  scope?: string;
  deliverables?: string;
  currency?: string;
  branch?: string;
  ownerId?: string;
  sourceProposalId?: string;
  sourceProposalNumber?: string;
  effectiveDate?: string;
  expiryDate?: string;
  autoRenew?: boolean;
  renewalNoticeDays?: number;
  value?: number;
  esignProvider?: string;
  notes?: string;
  attachments?: string[];
}

export type CrmContractUpdateInput = Partial<CrmContractCreateInput> & {
  status?: CrmContractStatus;
};

function buildListQuery(p?: CrmContractListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.type) qs.set('type', p.type);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmContractsApi = {
  list: (params?: CrmContractListParams) =>
    rustFetch<CrmContractListResponse>(`/v1/crm/contracts${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmContractDoc>(`/v1/crm/contracts/${encodeURIComponent(id)}`),
  create: (input: CrmContractCreateInput) =>
    rustFetch<{ id: string; entity: CrmContractDoc }>('/v1/crm/contracts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmContractUpdateInput) =>
    rustFetch<CrmContractDoc>(`/v1/crm/contracts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/contracts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
