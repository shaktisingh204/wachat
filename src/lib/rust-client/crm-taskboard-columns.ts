import 'server-only';

/**
 * CRM Taskboard Columns client — wraps `/v1/crm/taskboard-columns`.
 */
import { rustFetch } from './fetcher';

export type CrmTaskboardColumnStatus = 'active' | 'archived';

export interface CrmTaskboardColumnDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  boardId?: string;
  projectId?: string;
  color?: string;
  displayOrder: number;
  wipLimit?: number;
  defaultStatus?: string;
  isCollapsed: boolean;
  isDoneColumn: boolean;
  tasksCount: number;
  isActive: boolean;
  status: CrmTaskboardColumnStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTaskboardColumnListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTaskboardColumnStatus | 'all';
  boardId?: string;
  projectId?: string;
}

export interface CrmTaskboardColumnListResponse {
  items: CrmTaskboardColumnDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTaskboardColumnCreateInput {
  name: string;
  description?: string;
  boardId?: string;
  projectId?: string;
  color?: string;
  displayOrder?: number;
  wipLimit?: number;
  defaultStatus?: string;
  isCollapsed?: boolean;
  isDoneColumn?: boolean;
  isActive?: boolean;
}

export type CrmTaskboardColumnUpdateInput =
  Partial<CrmTaskboardColumnCreateInput> & {
    tasksCount?: number;
    status?: CrmTaskboardColumnStatus;
  };

function buildListQuery(p?: CrmTaskboardColumnListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.boardId) qs.set('boardId', p.boardId);
  if (p.projectId) qs.set('projectId', p.projectId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTaskboardColumnsApi = {
  list: (params?: CrmTaskboardColumnListParams) =>
    rustFetch<CrmTaskboardColumnListResponse>(
      `/v1/crm/taskboard-columns${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmTaskboardColumnDoc>(
      `/v1/crm/taskboard-columns/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmTaskboardColumnCreateInput) =>
    rustFetch<{ id: string; entity: CrmTaskboardColumnDoc }>(
      '/v1/crm/taskboard-columns',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmTaskboardColumnUpdateInput) =>
    rustFetch<CrmTaskboardColumnDoc>(
      `/v1/crm/taskboard-columns/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/taskboard-columns/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
