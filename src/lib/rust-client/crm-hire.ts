import 'server-only';

/**
 * CRM Hire (purchase lead) client — wraps `/v1/crm/hire`.
 *
 * Mirrors the Rust crate `crm-hire`, which reads/writes the existing
 * `crm_purchase_leads` collection so the persisted shape stays compatible
 * with the TS action surface in `crm-hire.actions.ts`. Wire format is
 * camelCase.
 */
import { rustFetch } from './fetcher';

export type CrmHireStatus = 'open' | 'won' | 'lost' | 'archived';
export type CrmHireStage = 'sourcing' | 'shortlisted' | 'negotiating' | 'closed';

export interface CrmHireDoc {
  _id: string;
  userId?: string;
  title: string;
  category?: string;
  vendorCandidate?: string;
  /** ISO-8601 date string. */
  requiredBy?: string;
  quantity?: number;
  estimatedBudget?: number;
  specs?: string;
  owner?: string;
  stage?: CrmHireStage | string;
  status?: CrmHireStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmHireListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmHireStatus | 'all' | string;
  stage?: CrmHireStage | string;
  category?: string;
}

export interface CrmHireListResponse {
  items: CrmHireDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmHireCreateInput {
  title: string;
  category?: string;
  vendorCandidate?: string;
  /** ISO-8601 date string. */
  requiredBy?: string;
  quantity?: number;
  estimatedBudget?: number;
  specs?: string;
  owner?: string;
  stage?: CrmHireStage | string;
  status?: CrmHireStatus | string;
}

export type CrmHireUpdateInput = Partial<CrmHireCreateInput>;

function buildListQuery(p?: CrmHireListParams): string {
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

export const crmHireApi = {
  list: (params?: CrmHireListParams) =>
    rustFetch<CrmHireListResponse>(`/v1/crm/hire${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmHireDoc>(`/v1/crm/hire/${encodeURIComponent(id)}`),
  create: (input: CrmHireCreateInput) =>
    rustFetch<{ id: string; entity: CrmHireDoc }>('/v1/crm/hire', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmHireUpdateInput) =>
    rustFetch<CrmHireDoc>(`/v1/crm/hire/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/hire/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
