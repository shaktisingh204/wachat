import 'server-only';

/**
 * CRM TDS Records client — wraps `/v1/crm/tds`.
 *
 * Mirrors the Rust crate `crm-tds` (collection `crm_tds_records`).
 * Per-employee quarterly TDS records. Wire format is camelCase.
 */
import { rustFetch } from './fetcher';

export type CrmTdsStatus = 'pending' | 'deposited' | 'filed' | 'archived';
export type CrmTdsQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface CrmTdsRecordDoc {
  _id: string;
  userId?: string;
  employeeId?: string;
  employeeName: string;
  /** e.g. `"2025-26"`. */
  financialYear: string;
  /** `"Q1"` | `"Q2"` | `"Q3"` | `"Q4"`. */
  quarter: string;
  tdsAmount: number;
  grossAmount: number;
  certificateNumber?: string;
  depositChallanNumber?: string;
  /** ISO-8601 date string. */
  depositDate?: string;
  /** `"pending"` | `"deposited"` | `"filed"` | `"archived"`. */
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTdsListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTdsStatus | 'all';
  financialYear?: string;
  quarter?: CrmTdsQuarter;
  employeeId?: string;
}

export interface CrmTdsListResponse {
  items: CrmTdsRecordDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTdsCreateInput {
  employeeId?: string;
  employeeName: string;
  financialYear: string;
  quarter: CrmTdsQuarter | string;
  tdsAmount?: number;
  grossAmount?: number;
  certificateNumber?: string;
  depositChallanNumber?: string;
  /** ISO-8601 date string. */
  depositDate?: string;
  status?: CrmTdsStatus | string;
  notes?: string;
}

export type CrmTdsUpdateInput = Partial<CrmTdsCreateInput>;

function buildListQuery(p?: CrmTdsListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.financialYear) qs.set('financialYear', p.financialYear);
  if (p.quarter) qs.set('quarter', p.quarter);
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTdsApi = {
  list: (params?: CrmTdsListParams) =>
    rustFetch<CrmTdsListResponse>(`/v1/crm/tds${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmTdsRecordDoc>(`/v1/crm/tds/${encodeURIComponent(id)}`),
  create: (input: CrmTdsCreateInput) =>
    rustFetch<{ id: string; entity: CrmTdsRecordDoc }>('/v1/crm/tds', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmTdsUpdateInput) =>
    rustFetch<CrmTdsRecordDoc>(`/v1/crm/tds/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/tds/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
