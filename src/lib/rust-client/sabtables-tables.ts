import 'server-only';

/**
 * SabTables Tables (schema) client — wraps `/v1/sabtables/tables`.
 * Mirrors `rust/crates/sabtables-tables/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabtablesFieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'single_select'
  | 'multi_select'
  | 'attachment'
  | 'link'
  | 'lookup'
  | 'formula'
  | 'rollup'
  | 'count'
  | 'user'
  | 'created_by'
  | 'created_at'
  | 'updated_by'
  | 'updated_at'
  | 'url'
  | 'email'
  | 'phone'
  | 'rating'
  | 'duration'
  | 'autonumber';

export interface SabtablesField {
  id: string;
  name: string;
  fieldType: SabtablesFieldType;
  options?: Record<string, unknown> | null;
  order?: number;
  isRequired?: boolean;
}

export interface SabtablesTableDoc {
  _id: string;
  userId: string;
  baseId: string;
  name: string;
  description?: string;
  primaryFieldId: string;
  fields: SabtablesField[];
  recordsCount: number;
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface SabtablesTableListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  baseId?: string;
}

export interface SabtablesTableListResponse {
  items: SabtablesTableDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabtablesTableCreateInput {
  baseId: string;
  name: string;
  description?: string;
  fields?: SabtablesField[];
  primaryFieldId?: string;
}

export type SabtablesTableUpdateInput = Partial<Omit<SabtablesTableCreateInput, 'baseId'>> & {
  status?: 'active' | 'archived';
};

export interface AddFieldInput {
  field: SabtablesField;
}

export interface UpdateFieldInput {
  fieldId: string;
  name?: string;
  options?: Record<string, unknown> | null;
  isRequired?: boolean;
}

function buildQuery(p?: SabtablesTableListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.baseId) qs.set('baseId', p.baseId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabtablesTablesApi = {
  list: (params?: SabtablesTableListParams) =>
    rustFetch<SabtablesTableListResponse>(`/v1/sabtables/tables${buildQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabtablesTableDoc>(`/v1/sabtables/tables/${encodeURIComponent(id)}`),
  create: (input: SabtablesTableCreateInput) =>
    rustFetch<{ id: string; entity: SabtablesTableDoc }>('/v1/sabtables/tables', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabtablesTableUpdateInput) =>
    rustFetch<SabtablesTableDoc>(`/v1/sabtables/tables/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabtables/tables/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  addField: (tableId: string, input: AddFieldInput) =>
    rustFetch<SabtablesTableDoc>(`/v1/sabtables/tables/${encodeURIComponent(tableId)}/fields`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateField: (tableId: string, input: UpdateFieldInput) =>
    rustFetch<SabtablesTableDoc>(
      `/v1/sabtables/tables/${encodeURIComponent(tableId)}/fields/update`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  deleteField: (tableId: string, fieldId: string) =>
    rustFetch<SabtablesTableDoc>(
      `/v1/sabtables/tables/${encodeURIComponent(tableId)}/fields/${encodeURIComponent(fieldId)}/delete`,
      { method: 'POST' },
    ),
};
