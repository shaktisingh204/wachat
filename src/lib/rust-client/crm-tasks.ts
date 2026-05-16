import 'server-only';

/**
 * CRM Tasks client — wraps `/v1/crm/tasks`.
 */
import { rustFetch } from './fetcher';

export type CrmTaskStatus =
  | 'To-Do'
  | 'In Progress'
  | 'Completed'
  | 'archived';

export interface CrmTaskChecklistItem {
  text: string;
  done?: boolean;
}

export interface CrmTaskDoc {
  _id: string;
  userId?: string;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  status?: CrmTaskStatus;
  dueDate?: string;
  reminders?: string[];
  checklist?: CrmTaskChecklistItem[];
  attachments?: string[];
  assignedTo?: string;
  createdBy?: string;
  linkedKind?: string;
  linkedId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTaskListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTaskStatus | 'all';
  priority?: string;
  assignedTo?: string;
  linkedKind?: string;
  linkedId?: string;
}

export interface CrmTaskListResponse {
  items: CrmTaskDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmTaskCreateInput {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  status?: CrmTaskStatus;
  dueDate?: string;
  reminders?: string[];
  checklist?: CrmTaskChecklistItem[];
  attachments?: string[];
  assignedTo?: string;
  linkedKind?: string;
  linkedId?: string;
}

export type CrmTaskUpdateInput = Partial<CrmTaskCreateInput>;

function buildListQuery(p?: CrmTaskListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.priority) qs.set('priority', p.priority);
  if (p.assignedTo) qs.set('assignedTo', p.assignedTo);
  if (p.linkedKind) qs.set('linkedKind', p.linkedKind);
  if (p.linkedId) qs.set('linkedId', p.linkedId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTasksApi = {
  list: (params?: CrmTaskListParams) =>
    rustFetch<CrmTaskListResponse>(`/v1/crm/tasks${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmTaskDoc>(`/v1/crm/tasks/${encodeURIComponent(id)}`),
  create: (input: CrmTaskCreateInput) =>
    rustFetch<{ id: string; entity: CrmTaskDoc }>('/v1/crm/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmTaskUpdateInput) =>
    rustFetch<CrmTaskDoc>(`/v1/crm/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
