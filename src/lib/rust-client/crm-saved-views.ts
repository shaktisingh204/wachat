import 'server-only';

/**
 * CRM SavedView client — wraps `/v1/crm/saved-views`.
 *
 * Saved views persist per-entity (leads, deals, invoices, ...) column +
 * filter + sort presets scoped per user. One view per (user, entity)
 * may be marked default.
 */
import { rustFetch } from './fetcher';

export type CrmSavedViewStatus = 'active' | 'archived';
export type CrmSavedViewScope = 'private' | 'shared';

export interface CrmSavedViewDoc {
  _id: string;
  userId?: string;
  name: string;
  entity: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort?: Record<string, unknown>;
  scope: CrmSavedViewScope;
  isDefault?: boolean;
  ownerId?: string;
  status: CrmSavedViewStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmSavedViewListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmSavedViewStatus | 'all';
  entity?: string;
  scope?: CrmSavedViewScope;
}

export interface CrmSavedViewListResponse {
  items: CrmSavedViewDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmSavedViewCreateInput {
  name: string;
  entity: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort?: Record<string, unknown>;
  scope?: CrmSavedViewScope;
  isDefault?: boolean;
}

export type CrmSavedViewUpdateInput = Partial<CrmSavedViewCreateInput> & {
  status?: CrmSavedViewStatus;
};

function buildListQuery(p?: CrmSavedViewListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.entity) qs.set('entity', p.entity);
  if (p.scope) qs.set('scope', p.scope);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmSavedViewsApi = {
  list: (params?: CrmSavedViewListParams) =>
    rustFetch<CrmSavedViewListResponse>(
      `/v1/crm/saved-views${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmSavedViewDoc>(
      `/v1/crm/saved-views/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmSavedViewCreateInput) =>
    rustFetch<{ id: string; entity: CrmSavedViewDoc }>(
      '/v1/crm/saved-views',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmSavedViewUpdateInput) =>
    rustFetch<CrmSavedViewDoc>(
      `/v1/crm/saved-views/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/saved-views/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
