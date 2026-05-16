import 'server-only';

/**
 * CRM Project Tasks client — wraps `/v1/crm/project-tasks`.
 */
import { rustFetch } from './fetcher';

export type CrmProjectTaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type CrmProjectTaskPriority = 'low' | 'medium' | 'high';

export interface CrmProjectTaskDoc {
  _id: string;
  userId?: string;
  title: string;
  description?: string;
  projectId?: string;
  assigneeId?: string;
  priority: CrmProjectTaskPriority | string;
  status: CrmProjectTaskStatus;
  dueDate?: string;
  progress?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmProjectTaskListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmProjectTaskStatus | 'all';
  projectId?: string;
  assigneeId?: string;
}

export interface CrmProjectTaskListResponse {
  items: CrmProjectTaskDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmProjectTaskCreateInput {
  title: string;
  description?: string;
  projectId?: string;
  assigneeId?: string;
  priority?: CrmProjectTaskPriority | string;
  status?: CrmProjectTaskStatus;
  dueDate?: string;
  progress?: number;
  tags?: string[];
}

export type CrmProjectTaskUpdateInput = Partial<CrmProjectTaskCreateInput>;

function buildListQuery(p?: CrmProjectTaskListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.projectId) qs.set('projectId', p.projectId);
  if (p.assigneeId) qs.set('assigneeId', p.assigneeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmProjectTasksApi = {
  list: (params?: CrmProjectTaskListParams) =>
    rustFetch<CrmProjectTaskListResponse>(
      `/v1/crm/project-tasks${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmProjectTaskDoc>(
      `/v1/crm/project-tasks/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmProjectTaskCreateInput) =>
    rustFetch<{ id: string; entity: CrmProjectTaskDoc }>(
      '/v1/crm/project-tasks',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmProjectTaskUpdateInput) =>
    rustFetch<CrmProjectTaskDoc>(
      `/v1/crm/project-tasks/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/project-tasks/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
