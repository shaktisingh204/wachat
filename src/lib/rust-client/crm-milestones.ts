import 'server-only';

/**
 * CRM Milestones client — wraps `/v1/crm/milestones`.
 */
import { rustFetch } from './fetcher';

export type CrmMilestoneStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'archived';

export type CrmMilestonePriority = 'low' | 'medium' | 'high';

export interface CrmMilestoneDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  projectId?: string;
  parentId?: string;
  dueDate?: string;
  completedAt?: string;
  /** 0..100 */
  progress?: number;
  priority: CrmMilestonePriority;
  status: CrmMilestoneStatus;
  ownerId?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmMilestoneListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmMilestoneStatus | 'all';
  projectId?: string;
  parentId?: string;
  ownerId?: string;
  priority?: CrmMilestonePriority;
}

export interface CrmMilestoneListResponse {
  items: CrmMilestoneDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmMilestoneCreateInput {
  name: string;
  description?: string;
  projectId?: string;
  parentId?: string;
  dueDate?: string;
  completedAt?: string;
  progress?: number;
  priority?: CrmMilestonePriority;
  status?: CrmMilestoneStatus;
  ownerId?: string;
  tags?: string[];
}

export type CrmMilestoneUpdateInput = Partial<CrmMilestoneCreateInput>;

function buildListQuery(p?: CrmMilestoneListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.projectId) qs.set('projectId', p.projectId);
  if (p.parentId) qs.set('parentId', p.parentId);
  if (p.ownerId) qs.set('ownerId', p.ownerId);
  if (p.priority) qs.set('priority', p.priority);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmMilestonesApi = {
  list: (params?: CrmMilestoneListParams) =>
    rustFetch<CrmMilestoneListResponse>(
      `/v1/crm/milestones${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmMilestoneDoc>(
      `/v1/crm/milestones/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmMilestoneCreateInput) =>
    rustFetch<{ id: string; entity: CrmMilestoneDoc }>(
      '/v1/crm/milestones',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmMilestoneUpdateInput) =>
    rustFetch<CrmMilestoneDoc>(
      `/v1/crm/milestones/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/milestones/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
