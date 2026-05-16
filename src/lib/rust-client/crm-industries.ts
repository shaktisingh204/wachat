import 'server-only';

/**
 * CRM Industry client — wraps `/v1/crm/industries`.
 *
 * Counterpart of the Rust crate `crm-industries`. Industries are the
 * tenant-scoped classification taxonomy referenced by accounts, contacts,
 * and leads.
 */
import { rustFetch } from './fetcher';

export type CrmIndustryStatus = 'active' | 'archived';

export interface CrmIndustryDoc {
  _id: string;
  userId?: string;
  name: string;
  slug?: string;
  parentId?: string;
  description?: string;
  isActive: boolean;
  status: CrmIndustryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmIndustryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmIndustryStatus | 'all';
  /** Parent industry id. Pass the literal string `"null"` for top-level only. */
  parentId?: string;
}

export interface CrmIndustryListResponse {
  items: CrmIndustryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmIndustryCreateInput {
  name: string;
  slug?: string;
  parentId?: string;
  description?: string;
  isActive?: boolean;
}

export type CrmIndustryUpdateInput = Partial<CrmIndustryCreateInput> & {
  status?: CrmIndustryStatus;
};

function buildListQuery(p?: CrmIndustryListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.parentId) qs.set('parentId', p.parentId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmIndustriesApi = {
  list: (params?: CrmIndustryListParams) =>
    rustFetch<CrmIndustryListResponse>(
      `/v1/crm/industries${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmIndustryDoc>(
      `/v1/crm/industries/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmIndustryCreateInput) =>
    rustFetch<{ id: string; entity: CrmIndustryDoc }>('/v1/crm/industries', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmIndustryUpdateInput) =>
    rustFetch<CrmIndustryDoc>(
      `/v1/crm/industries/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/industries/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
