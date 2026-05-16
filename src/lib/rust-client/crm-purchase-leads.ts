import 'server-only';

/**
 * CRM Purchase Leads client — wraps `/v1/crm/purchase-leads`.
 */
import { rustFetch } from './fetcher';

export type CrmPurchaseLeadStatus =
  | 'open'
  | 'won'
  | 'lost'
  | 'cancelled'
  | 'archived';

export type CrmPurchaseLeadStage =
  | 'sourcing'
  | 'shortlisted'
  | 'negotiation'
  | 'awarded'
  | 'closed';

export interface CrmPurchaseLeadDoc {
  _id: string;
  userId?: string;
  title: string;
  category?: string;
  vendorCandidate?: string;
  requiredBy?: string;
  quantity?: number;
  estimatedBudget?: number;
  specs?: string;
  owner?: string;
  stage: CrmPurchaseLeadStage | string;
  status: CrmPurchaseLeadStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPurchaseLeadListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPurchaseLeadStatus | 'all';
  stage?: CrmPurchaseLeadStage | string;
  category?: string;
}

export interface CrmPurchaseLeadListResponse {
  items: CrmPurchaseLeadDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPurchaseLeadCreateInput {
  title: string;
  category?: string;
  vendorCandidate?: string;
  requiredBy?: string;
  quantity?: number;
  estimatedBudget?: number;
  specs?: string;
  owner?: string;
}

export type CrmPurchaseLeadUpdateInput = Partial<CrmPurchaseLeadCreateInput> & {
  stage?: CrmPurchaseLeadStage | string;
  status?: CrmPurchaseLeadStatus;
};

function buildListQuery(p?: CrmPurchaseLeadListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.stage) qs.set('stage', p.stage);
  if (p.category) qs.set('category', p.category);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPurchaseLeadsApi = {
  list: (params?: CrmPurchaseLeadListParams) =>
    rustFetch<CrmPurchaseLeadListResponse>(
      `/v1/crm/purchase-leads${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPurchaseLeadDoc>(
      `/v1/crm/purchase-leads/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmPurchaseLeadCreateInput) =>
    rustFetch<{ id: string; entity: CrmPurchaseLeadDoc }>(
      '/v1/crm/purchase-leads',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmPurchaseLeadUpdateInput) =>
    rustFetch<CrmPurchaseLeadDoc>(
      `/v1/crm/purchase-leads/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/purchase-leads/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
