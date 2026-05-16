import 'server-only';

/**
 * CRM Tag client — wraps `/v1/crm/tags`.
 *
 * Counterpart of the Rust crate `crm-tags`. Foundational lookup entity
 * referenced cross-module for categorization.
 */
import { rustFetch } from './fetcher';

export type CrmTagScope = 'lead' | 'deal' | 'task' | 'contact' | 'all' | string;

export interface CrmTagDoc {
  _id: string;
  userId?: string;
  name: string;
  color?: string;
  description?: string;
  scope?: CrmTagScope;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'archived';
}

export interface CrmTagListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  scope?: CrmTagScope;
}

export interface CrmTagListResponse {
  items: CrmTagDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTagCreateInput {
  name: string;
  color?: string;
  description?: string;
  scope?: CrmTagScope;
}

export type CrmTagUpdateInput = Partial<CrmTagCreateInput> & {
  status?: 'active' | 'archived';
};

function buildListQuery(p?: CrmTagListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.scope) qs.set('scope', p.scope);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTagsApi = {
  list: (params?: CrmTagListParams) =>
    rustFetch<CrmTagListResponse>(`/v1/crm/tags${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmTagDoc>(`/v1/crm/tags/${encodeURIComponent(id)}`),
  create: (input: CrmTagCreateInput) =>
    rustFetch<{ id: string; entity: CrmTagDoc }>('/v1/crm/tags', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmTagUpdateInput) =>
    rustFetch<CrmTagDoc>(`/v1/crm/tags/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/tags/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
