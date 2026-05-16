import 'server-only';

/**
 * CRM Settings client — wraps `/v1/crm/settings`.
 *
 * Per-tenant key/value store. `value` is a free-form JSON object whose
 * shape is owned by the caller; the BFF does not validate or normalise it.
 */
import { rustFetch } from './fetcher';

export type CrmSettingStatus = 'active' | 'archived';

export interface CrmSettingDoc {
  _id: string;
  userId?: string;
  key: string;
  value?: Record<string, unknown>;
  category?: string;
  description?: string;
  isSecret?: boolean;
  isActive?: boolean;
  status: CrmSettingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmSettingListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmSettingStatus | 'all';
  category?: string;
}

export interface CrmSettingListResponse {
  items: CrmSettingDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmSettingCreateInput {
  key: string;
  value?: Record<string, unknown>;
  category?: string;
  description?: string;
  isSecret?: boolean;
  isActive?: boolean;
}

export type CrmSettingUpdateInput = Partial<CrmSettingCreateInput> & {
  status?: CrmSettingStatus;
};

function buildListQuery(p?: CrmSettingListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.category) qs.set('category', p.category);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmSettingsApi = {
  list: (params?: CrmSettingListParams) =>
    rustFetch<CrmSettingListResponse>(
      `/v1/crm/settings${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmSettingDoc>(
      `/v1/crm/settings/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmSettingCreateInput) =>
    rustFetch<{ id: string; entity: CrmSettingDoc }>(
      '/v1/crm/settings',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmSettingUpdateInput) =>
    rustFetch<CrmSettingDoc>(
      `/v1/crm/settings/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/settings/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
