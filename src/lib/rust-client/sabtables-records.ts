import 'server-only';

/**
 * SabTables Records client — wraps `/v1/sabtables/records`.
 * Mirrors `rust/crates/sabtables-records/src/types.rs` and exposes the
 * `evaluate-formula` preview endpoint.
 */
import { rustFetch } from './fetcher';

export interface SabtablesRecordDoc {
  _id: string;
  userId: string;
  tableId: string;
  fieldsJson: Record<string, unknown>;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  status: 'active' | 'archived';
}

export interface SabtablesRecordListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  tableId: string;
}

export interface SabtablesRecordListResponse {
  items: SabtablesRecordDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabtablesRecordCreateInput {
  tableId: string;
  fieldsJson?: Record<string, unknown>;
}

export interface SabtablesRecordUpdateInput {
  fieldsJson?: Record<string, unknown>;
  status?: 'active' | 'archived';
}

export interface EvaluateFormulaInput {
  expression: string;
  fields?: Record<string, unknown>;
}

export interface EvaluateFormulaResponse {
  value: unknown;
}

function buildQuery(p: SabtablesRecordListParams): string {
  const qs = new URLSearchParams();
  qs.set('tableId', p.tableId);
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  return `?${qs.toString()}`;
}

export const sabtablesRecordsApi = {
  list: (params: SabtablesRecordListParams) =>
    rustFetch<SabtablesRecordListResponse>(`/v1/sabtables/records${buildQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabtablesRecordDoc>(`/v1/sabtables/records/${encodeURIComponent(id)}`),
  create: (input: SabtablesRecordCreateInput) =>
    rustFetch<{ id: string; entity: SabtablesRecordDoc }>('/v1/sabtables/records', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabtablesRecordUpdateInput) =>
    rustFetch<SabtablesRecordDoc>(`/v1/sabtables/records/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabtables/records/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  evaluateFormula: (input: EvaluateFormulaInput) =>
    rustFetch<EvaluateFormulaResponse>('/v1/sabtables/records/evaluate-formula', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
