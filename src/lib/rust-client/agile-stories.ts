import 'server-only';

/**
 * Agile Stories client — wraps `/v1/agile/stories`.
 */
import { rustFetch } from './fetcher';

export type AgileStoryStatus =
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'archived';
export type AgileStoryPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AgileStoryDoc {
  _id: string;
  userId?: string;
  projectId: string;
  sprintId?: string;
  epicId?: string;
  title: string;
  description?: string;
  points?: number;
  status: AgileStoryStatus;
  priority: AgileStoryPriority;
  assigneeId?: string;
  acceptanceCriteria?: string[];
  rank?: number;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgileStoryListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: AgileStoryStatus | 'all';
  projectId?: string;
  sprintId?: string;
  /** Pass `'null'` to filter to backlog (stories with no sprint). */
  sprintFilter?: 'null' | 'backlog';
  epicId?: string;
  assigneeId?: string;
  priority?: AgileStoryPriority;
}

export interface AgileStoryListResponse {
  items: AgileStoryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AgileStoryCreateInput {
  projectId: string;
  title: string;
  description?: string;
  sprintId?: string;
  epicId?: string;
  points?: number;
  status?: AgileStoryStatus;
  priority?: AgileStoryPriority;
  assigneeId?: string;
  acceptanceCriteria?: string[];
  rank?: number;
}

export type AgileStoryUpdateInput = Partial<
  Omit<AgileStoryCreateInput, 'projectId'>
>;

export interface AgileStoryReorderEntry {
  id: string;
  rank: number;
}

function buildListQuery(p?: AgileStoryListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.projectId) qs.set('projectId', p.projectId);
  if (p.sprintId) qs.set('sprintId', p.sprintId);
  if (p.sprintFilter) qs.set('sprintFilter', p.sprintFilter);
  if (p.epicId) qs.set('epicId', p.epicId);
  if (p.assigneeId) qs.set('assigneeId', p.assigneeId);
  if (p.priority) qs.set('priority', p.priority);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const agileStoriesApi = {
  list: (params?: AgileStoryListParams) =>
    rustFetch<AgileStoryListResponse>(
      `/v1/agile/stories${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<AgileStoryDoc>(`/v1/agile/stories/${encodeURIComponent(id)}`),
  create: (input: AgileStoryCreateInput) =>
    rustFetch<{ id: string; entity: AgileStoryDoc }>('/v1/agile/stories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: AgileStoryUpdateInput) =>
    rustFetch<AgileStoryDoc>(`/v1/agile/stories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/agile/stories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  reorder: (items: AgileStoryReorderEntry[]) =>
    rustFetch<{ updated: number }>('/v1/agile/stories/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
};
