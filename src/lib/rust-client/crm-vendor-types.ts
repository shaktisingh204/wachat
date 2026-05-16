import 'server-only';

/**
 * CRM Vendor Type client — wraps `/v1/crm/vendor-types`.
 *
 * Master/lookup entity used to classify CRM vendors
 * (Supplier, Service Provider, Contractor, ...).
 */
import { rustFetch } from './fetcher';

export type CrmVendorTypeStatus = 'active' | 'archived';

export interface CrmVendorTypeDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
  status: CrmVendorTypeStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmVendorTypeListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmVendorTypeStatus | 'all';
  isActive?: boolean;
}

export interface CrmVendorTypeListResponse {
  items: CrmVendorTypeDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmVendorTypeCreateInput {
  name: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export type CrmVendorTypeUpdateInput = Partial<CrmVendorTypeCreateInput> & {
  status?: CrmVendorTypeStatus;
};

function buildListQuery(p?: CrmVendorTypeListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmVendorTypesApi = {
  list: (params?: CrmVendorTypeListParams) =>
    rustFetch<CrmVendorTypeListResponse>(
      `/v1/crm/vendor-types${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmVendorTypeDoc>(
      `/v1/crm/vendor-types/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmVendorTypeCreateInput) =>
    rustFetch<{ id: string; entity: CrmVendorTypeDoc }>(
      '/v1/crm/vendor-types',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmVendorTypeUpdateInput) =>
    rustFetch<CrmVendorTypeDoc>(
      `/v1/crm/vendor-types/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/vendor-types/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
