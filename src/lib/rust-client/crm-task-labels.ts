import 'server-only';

/**
 * CRM TaskLabel client — wraps `/v1/crm/task-labels`.
 *
 * Color-coded classification labels applied to tasks. Name is unique per
 * tenant (among non-archived labels). Color is required; icon is optional
 * presentation. `tasksCount` is a denormalized usage counter maintained
 * server-side.
 */
import { rustFetch } from './fetcher';

export type CrmTaskLabelStatus = 'active' | 'archived';

export interface CrmTaskLabelDoc {
  _id: string;
  userId?: string;
  name: string;
  color: string;
  description?: string;
  icon?: string;
  tasksCount: number;
  isActive: boolean;
  status: CrmTaskLabelStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTaskLabelListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTaskLabelStatus | 'all';
  isActive?: boolean;
}

export interface CrmTaskLabelListResponse {
  items: CrmTaskLabelDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTaskLabelCreateInput {
  name: string;
  color: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
}

export type CrmTaskLabelUpdateInput = Partial<CrmTaskLabelCreateInput> & {
  status?: CrmTaskLabelStatus;
};

function buildListQuery(p?: CrmTaskLabelListParams): string {
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

export const crmTaskLabelsApi = {
  list: (params?: CrmTaskLabelListParams) =>
    rustFetch<CrmTaskLabelListResponse>(
      `/v1/crm/task-labels${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTaskLabelDoc>(
      `/v1/crm/task-labels/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTaskLabelCreateInput) =>
    rustFetch<{ id: string; entity: CrmTaskLabelDoc }>(
      '/v1/crm/task-labels',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmTaskLabelUpdateInput) =>
    rustFetch<CrmTaskLabelDoc>(
      `/v1/crm/task-labels/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/task-labels/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
