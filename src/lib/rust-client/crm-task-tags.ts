import 'server-only';

/**
 * CRM Task Tag client — wraps `/v1/crm/task-tags`.
 *
 * Names are case-insensitively unique per tenant among non-archived tags.
 */
import { rustFetch } from './fetcher';

export type CrmTaskTagStatus = 'active' | 'archived';

export interface CrmTaskTagDoc {
  _id: string;
  userId?: string;
  name: string;
  color?: string;
  description?: string;
  tasksCount?: number;
  isActive?: boolean;
  status: CrmTaskTagStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTaskTagListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTaskTagStatus | 'all';
  isActive?: boolean;
}

export interface CrmTaskTagListResponse {
  items: CrmTaskTagDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTaskTagCreateInput {
  name: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

export type CrmTaskTagUpdateInput = Partial<CrmTaskTagCreateInput> & {
  status?: CrmTaskTagStatus;
};

function buildListQuery(p?: CrmTaskTagListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTaskTagsApi = {
  list: (params?: CrmTaskTagListParams) =>
    rustFetch<CrmTaskTagListResponse>(
      `/v1/crm/task-tags${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTaskTagDoc>(
      `/v1/crm/task-tags/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTaskTagCreateInput) =>
    rustFetch<{ id: string; entity: CrmTaskTagDoc }>(
      '/v1/crm/task-tags',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: CrmTaskTagUpdateInput) =>
    rustFetch<CrmTaskTagDoc>(
      `/v1/crm/task-tags/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/task-tags/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
