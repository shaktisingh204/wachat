import 'server-only';

/**
 * CRM Subtasks client — wraps `/v1/crm/subtasks`.
 *
 * A subtask is a child task that belongs to a parent `crm_tasks`
 * (`parentKind = "task"`) or `crm_project_tasks` (`parentKind = "project_task"`)
 * document. The parent is identified by `parentId` + `parentKind`.
 */
import { rustFetch } from './fetcher';

export type CrmSubtaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type CrmSubtaskParentKind = 'task' | 'project_task';

export interface CrmSubtaskDoc {
  _id: string;
  userId?: string;
  parentId: string;
  parentKind: CrmSubtaskParentKind;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  order?: number;
  status: CrmSubtaskStatus;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmSubtaskListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmSubtaskStatus | 'all';
  parentId?: string;
  parentKind?: CrmSubtaskParentKind;
  assigneeId?: string;
}

export interface CrmSubtaskListResponse {
  items: CrmSubtaskDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmSubtaskCreateInput {
  parentId: string;
  parentKind?: CrmSubtaskParentKind;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  order?: number;
  status?: CrmSubtaskStatus;
}

export type CrmSubtaskUpdateInput = Partial<
  Omit<CrmSubtaskCreateInput, 'parentId' | 'parentKind'>
> & {
  status?: CrmSubtaskStatus;
};

function buildListQuery(p?: CrmSubtaskListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.parentId) qs.set('parentId', p.parentId);
  if (p.parentKind) qs.set('parentKind', p.parentKind);
  if (p.assigneeId) qs.set('assigneeId', p.assigneeId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmSubtasksApi = {
  list: (params?: CrmSubtaskListParams) =>
    rustFetch<CrmSubtaskListResponse>(
      `/v1/crm/subtasks${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmSubtaskDoc>(`/v1/crm/subtasks/${encodeURIComponent(id)}`),
  create: (input: CrmSubtaskCreateInput) =>
    rustFetch<{ id: string; entity: CrmSubtaskDoc }>('/v1/crm/subtasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmSubtaskUpdateInput) =>
    rustFetch<CrmSubtaskDoc>(`/v1/crm/subtasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/subtasks/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
