import 'server-only';

/**
 * CRM Taxes client — wraps `/v1/crm/taxes`.
 *
 * Backed by the `crm_taxes` MongoDB collection (tenant-scoped via
 * `userId`). The Rust BFF normalizes the on-disk shape to camelCase
 * (`name` + `rate` + `taxType` + `components`).
 */
import { rustFetch } from './fetcher';

export type CrmTaxStatus = 'active' | 'archived';
export type CrmTaxType = 'GST' | 'VAT' | 'sales' | 'custom';

/**
 * Component split for a composite tax (e.g. GST 18% = CGST 9% + SGST 9%).
 * Kept open so callers can attach extra metadata without schema churn.
 */
export interface CrmTaxComponent {
  name?: string;
  code?: string;
  rate?: number;
  [k: string]: unknown;
}

export interface CrmTaxDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  rate: number;
  taxType?: CrmTaxType | string;
  components?: CrmTaxComponent[];
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
  status: CrmTaxStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTaxListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTaxStatus | 'all';
  taxType?: CrmTaxType | string;
}

export interface CrmTaxListResponse {
  items: CrmTaxDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTaxCreateInput {
  name: string;
  code?: string;
  rate?: number;
  taxType?: CrmTaxType | string;
  components?: CrmTaxComponent[];
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export type CrmTaxUpdateInput = Partial<CrmTaxCreateInput> & {
  status?: CrmTaxStatus;
};

function buildListQuery(p?: CrmTaxListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.taxType) qs.set('taxType', p.taxType);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTaxesApi = {
  list: (params?: CrmTaxListParams) =>
    rustFetch<CrmTaxListResponse>(`/v1/crm/taxes${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmTaxDoc>(`/v1/crm/taxes/${encodeURIComponent(id)}`),
  create: (input: CrmTaxCreateInput) =>
    rustFetch<{ id: string; entity: CrmTaxDoc }>('/v1/crm/taxes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmTaxUpdateInput) =>
    rustFetch<CrmTaxDoc>(`/v1/crm/taxes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/taxes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
