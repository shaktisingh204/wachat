import 'server-only';

/**
 * SabTables Views client — wraps `/v1/sabtables/views`.
 * Mirrors `rust/crates/sabtables-views/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabtablesViewKind = 'grid' | 'kanban' | 'gallery' | 'calendar' | 'gantt' | 'form';

export interface SabtablesViewDoc {
  _id: string;
  userId: string;
  tableId: string;
  name: string;
  kind: SabtablesViewKind;
  configJson: Record<string, unknown>;
  formToken?: string;
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface SabtablesViewListParams {
  tableId?: string;
  status?: 'active' | 'archived' | 'all';
  kind?: SabtablesViewKind;
}

export interface SabtablesViewListResponse {
  items: SabtablesViewDoc[];
}

export interface SabtablesViewCreateInput {
  tableId: string;
  name: string;
  kind: SabtablesViewKind;
  configJson?: Record<string, unknown>;
}

export interface SabtablesViewUpdateInput {
  name?: string;
  configJson?: Record<string, unknown>;
  status?: 'active' | 'archived';
}

function buildQuery(p?: SabtablesViewListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.tableId) qs.set('tableId', p.tableId);
  if (p.status) qs.set('status', p.status);
  if (p.kind) qs.set('kind', p.kind);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabtablesViewsApi = {
  list: (params?: SabtablesViewListParams) =>
    rustFetch<SabtablesViewListResponse>(`/v1/sabtables/views${buildQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabtablesViewDoc>(`/v1/sabtables/views/${encodeURIComponent(id)}`),
  create: (input: SabtablesViewCreateInput) =>
    rustFetch<{ id: string; entity: SabtablesViewDoc }>('/v1/sabtables/views', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabtablesViewUpdateInput) =>
    rustFetch<SabtablesViewDoc>(`/v1/sabtables/views/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabtables/views/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  /** Public form-token resolution for `/sabtables/form/[formToken]`. */
  getByFormToken: (formToken: string) =>
    rustFetch<SabtablesViewDoc>(
      `/v1/sabtables/views/form/${encodeURIComponent(formToken)}`,
    ),
};
