import 'server-only';

/**
 * CRM PF/ESI Records client — wraps `/v1/crm/pf-esi`.
 *
 * Mirrors the Rust crate `crm-pf-esi` (collection `crm_pf_esi_records`).
 * Monthly per-employee PF + ESI records. Wire format is camelCase.
 */
import { rustFetch } from './fetcher';

export type CrmPfEsiStatus = 'pending' | 'deposited' | 'filed' | 'archived';

export interface CrmPfEsiRecordDoc {
  _id: string;
  userId?: string;
  employeeId?: string;
  employeeName: string;
  /** `YYYY-MM`. */
  month: string;
  pfEmployer: number;
  pfEmployee: number;
  pfUan?: string;
  esiEmployer: number;
  esiEmployee: number;
  esiIcNumber?: string;
  challanNumber?: string;
  documentUrl?: string;
  /** ISO-8601 date string. */
  depositDate?: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmPfEsiListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPfEsiStatus | 'all';
  /** `YYYY-MM`. */
  month?: string;
  employeeId?: string;
}

export interface CrmPfEsiListResponse {
  items: CrmPfEsiRecordDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmPfEsiCreateInput {
  employeeId?: string;
  employeeName: string;
  /** `YYYY-MM`. */
  month: string;
  pfEmployer?: number;
  pfEmployee?: number;
  pfUan?: string;
  esiEmployer?: number;
  esiEmployee?: number;
  esiIcNumber?: string;
  challanNumber?: string;
  documentUrl?: string;
  /** ISO-8601 date string. */
  depositDate?: string;
  status?: CrmPfEsiStatus | string;
  notes?: string;
}

export type CrmPfEsiUpdateInput = Partial<CrmPfEsiCreateInput>;

function buildListQuery(p?: CrmPfEsiListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.month) qs.set('month', p.month);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmPfEsiApi = {
  list: (params?: CrmPfEsiListParams) =>
    rustFetch<CrmPfEsiListResponse>(`/v1/crm/pf-esi${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmPfEsiRecordDoc>(`/v1/crm/pf-esi/${encodeURIComponent(id)}`),
  create: (input: CrmPfEsiCreateInput) =>
    rustFetch<{ id: string; entity: CrmPfEsiRecordDoc }>('/v1/crm/pf-esi', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmPfEsiUpdateInput) =>
    rustFetch<CrmPfEsiRecordDoc>(`/v1/crm/pf-esi/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/pf-esi/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
