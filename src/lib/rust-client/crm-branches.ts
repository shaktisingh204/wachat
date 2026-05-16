import 'server-only';

/**
 * CRM Branch client — wraps `/v1/crm/branches`.
 *
 * Counterpart of the Rust crate `crm-branches`. Tenant-owned physical or
 * logical locations referenced by items, accounts, vendors, and employees.
 */
import { rustFetch } from './fetcher';

export type CrmBranchKind = 'hq' | 'sales' | 'warehouse' | 'factory' | 'branch' | string;

export interface CrmBranchDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  managerId?: string;
  kind?: CrmBranchKind;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'archived';
}

export interface CrmBranchListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  kind?: CrmBranchKind;
  city?: string;
}

export interface CrmBranchListResponse {
  items: CrmBranchDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmBranchCreateInput {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  managerId?: string;
  kind?: CrmBranchKind;
  isDefault?: boolean;
}

export type CrmBranchUpdateInput = Partial<CrmBranchCreateInput> & {
  status?: 'active' | 'archived';
};

function buildListQuery(p?: CrmBranchListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.kind) qs.set('kind', p.kind);
  if (p.city) qs.set('city', p.city);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmBranchesApi = {
  list: (params?: CrmBranchListParams) =>
    rustFetch<CrmBranchListResponse>(`/v1/crm/branches${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmBranchDoc>(`/v1/crm/branches/${encodeURIComponent(id)}`),
  create: (input: CrmBranchCreateInput) =>
    rustFetch<{ id: string; entity: CrmBranchDoc }>('/v1/crm/branches', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmBranchUpdateInput) =>
    rustFetch<CrmBranchDoc>(`/v1/crm/branches/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/branches/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
