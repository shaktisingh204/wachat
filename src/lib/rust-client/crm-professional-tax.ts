import 'server-only';

/**
 * CRM Professional Tax Records client — wraps `/v1/crm/professional-tax`.
 *
 * Mirrors the Rust crate `crm-professional-tax`
 * (collection `crm_professional_tax_records`). State-aware monthly PT
 * records. Wire format is camelCase.
 */
import { rustFetch } from './fetcher';

export type CrmProfessionalTaxStatus =
  | 'pending'
  | 'deposited'
  | 'filed'
  | 'archived';

export interface CrmProfessionalTaxRecordDoc {
  _id: string;
  userId?: string;
  employeeId?: string;
  employeeName: string;
  /** e.g. `"Karnataka"`. */
  state: string;
  /** `YYYY-MM`. */
  month: string;
  grossSalary: number;
  ptAmount: number;
  /** Stamped slab descriptor at save time. */
  slabApplied?: string;
  challanNumber?: string;
  /** ISO-8601 date string. */
  depositDate?: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProfessionalTaxListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmProfessionalTaxStatus | 'all';
  state?: string;
  /** `YYYY-MM`. */
  month?: string;
  employeeId?: string;
}

export interface CrmProfessionalTaxListResponse {
  items: CrmProfessionalTaxRecordDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmProfessionalTaxCreateInput {
  employeeId?: string;
  employeeName: string;
  state: string;
  /** `YYYY-MM`. */
  month: string;
  grossSalary?: number;
  ptAmount?: number;
  slabApplied?: string;
  challanNumber?: string;
  /** ISO-8601 date string. */
  depositDate?: string;
  status?: CrmProfessionalTaxStatus | string;
  notes?: string;
}

export type CrmProfessionalTaxUpdateInput =
  Partial<CrmProfessionalTaxCreateInput>;

function buildListQuery(p?: CrmProfessionalTaxListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.state) qs.set('state', p.state);
  if (p.month) qs.set('month', p.month);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmProfessionalTaxApi = {
  list: (params?: CrmProfessionalTaxListParams) =>
    rustFetch<CrmProfessionalTaxListResponse>(
      `/v1/crm/professional-tax${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmProfessionalTaxRecordDoc>(
      `/v1/crm/professional-tax/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmProfessionalTaxCreateInput) =>
    rustFetch<{ id: string; entity: CrmProfessionalTaxRecordDoc }>(
      '/v1/crm/professional-tax',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmProfessionalTaxUpdateInput) =>
    rustFetch<CrmProfessionalTaxRecordDoc>(
      `/v1/crm/professional-tax/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/professional-tax/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
