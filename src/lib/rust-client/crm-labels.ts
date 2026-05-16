import 'server-only';

/**
 * CRM Label client — wraps `/v1/crm/labels`.
 *
 * Counterpart of the Rust crate `crm-labels`. Lightweight per-row marker
 * for chat/inbox/task surfaces. Distinct from `tags`: typically
 * system-defined and lower-cardinality.
 */
import { rustFetch } from './fetcher';

export interface CrmLabelDoc {
  _id: string;
  userId?: string;
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'archived';
}

export interface CrmLabelListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'active' | 'archived' | 'all';
}

export interface CrmLabelListResponse {
  items: CrmLabelDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmLabelCreateInput {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
}

export type CrmLabelUpdateInput = Partial<CrmLabelCreateInput> & {
  status?: 'active' | 'archived';
};

function buildListQuery(p?: CrmLabelListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmLabelsApi = {
  list: (params?: CrmLabelListParams) =>
    rustFetch<CrmLabelListResponse>(`/v1/crm/labels${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmLabelDoc>(`/v1/crm/labels/${encodeURIComponent(id)}`),
  create: (input: CrmLabelCreateInput) =>
    rustFetch<{ id: string; entity: CrmLabelDoc }>('/v1/crm/labels', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmLabelUpdateInput) =>
    rustFetch<CrmLabelDoc>(`/v1/crm/labels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/labels/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
