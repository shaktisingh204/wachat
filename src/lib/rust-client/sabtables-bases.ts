import 'server-only';

/**
 * SabTables Bases client — wraps `/v1/sabtables/bases`.
 * Mirrors `rust/crates/sabtables-bases/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabtablesBaseStatus = 'active' | 'archived';

export interface SabtablesBaseDoc {
  _id: string;
  userId: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  status: SabtablesBaseStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabtablesBaseListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabtablesBaseStatus | 'all';
  workspaceId?: string;
}

export interface SabtablesBaseListResponse {
  items: SabtablesBaseDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabtablesBaseCreateInput {
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export type SabtablesBaseUpdateInput = Partial<Omit<SabtablesBaseCreateInput, 'workspaceId'>> & {
  status?: SabtablesBaseStatus;
};

function buildQuery(p?: SabtablesBaseListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.workspaceId) qs.set('workspaceId', p.workspaceId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabtablesBasesApi = {
  list: (params?: SabtablesBaseListParams) =>
    rustFetch<SabtablesBaseListResponse>(`/v1/sabtables/bases${buildQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabtablesBaseDoc>(`/v1/sabtables/bases/${encodeURIComponent(id)}`),
  create: (input: SabtablesBaseCreateInput) =>
    rustFetch<{ id: string; entity: SabtablesBaseDoc }>('/v1/sabtables/bases', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabtablesBaseUpdateInput) =>
    rustFetch<SabtablesBaseDoc>(`/v1/sabtables/bases/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabtables/bases/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
