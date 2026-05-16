import 'server-only';

/**
 * CRM Policies client — wraps `/v1/crm/policies`.
 */
import { rustFetch } from './fetcher';

export type CrmPolicyStatus =
  | 'draft'
  | 'published'
  | 'under_review'
  | 'archived'
  | 'obsolete';

export type CrmPolicyCategory =
  | 'leave'
  | 'travel'
  | 'code_of_conduct'
  | 'it_security'
  | 'hr'
  | 'finance'
  | 'other';

export interface CrmPolicyDoc {
  _id: string;
  userId?: string;
  name: string;
  version?: string;
  category?: CrmPolicyCategory | string;
  summary?: string;
  documentUrl?: string;
  content?: string;
  effectiveDate?: string;
  reviewDate?: string;
  expiryDate?: string;
  ownerId?: string;
  departmentIds?: string[];
  acknowledgementRequired?: boolean;
  acknowledgementCount?: number;
  status: CrmPolicyStatus;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPolicyListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPolicyStatus | 'all';
  category?: CrmPolicyCategory | string;
}

export interface CrmPolicyListResponse {
  items: CrmPolicyDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPolicyCreateInput {
  name: string;
  version?: string;
  category?: CrmPolicyCategory | string;
  summary?: string;
  documentUrl?: string;
  content?: string;
  effectiveDate?: string;
  reviewDate?: string;
  expiryDate?: string;
  ownerId?: string;
  departmentIds?: string[];
  acknowledgementRequired?: boolean;
  status?: CrmPolicyStatus;
  tags?: string[];
}

export type CrmPolicyUpdateInput = Partial<CrmPolicyCreateInput> & {
  acknowledgementCount?: number;
};

function buildListQuery(p?: CrmPolicyListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPoliciesApi = {
  list: (params?: CrmPolicyListParams) =>
    rustFetch<CrmPolicyListResponse>(
      `/v1/crm/policies${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmPolicyDoc>(`/v1/crm/policies/${encodeURIComponent(id)}`),
  create: (input: CrmPolicyCreateInput) =>
    rustFetch<{ id: string; entity: CrmPolicyDoc }>('/v1/crm/policies', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmPolicyUpdateInput) =>
    rustFetch<CrmPolicyDoc>(`/v1/crm/policies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/policies/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
