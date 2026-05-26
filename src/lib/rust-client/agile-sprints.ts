import 'server-only';

/**
 * Agile Sprints client — wraps `/v1/agile/sprints`.
 */
import { rustFetch } from './fetcher';

export type AgileSprintStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface AgileSprintDoc {
  _id: string;
  userId?: string;
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  /** Story points capacity. */
  capacityPoints?: number;
  status: AgileSprintStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgileSprintListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: AgileSprintStatus | 'all';
  projectId?: string;
}

export interface AgileSprintListResponse {
  items: AgileSprintDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AgileSprintCreateInput {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  capacityPoints?: number;
  status?: AgileSprintStatus;
}

export type AgileSprintUpdateInput = Partial<Omit<AgileSprintCreateInput, 'projectId'>>;

function buildListQuery(p?: AgileSprintListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.projectId) qs.set('projectId', p.projectId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const agileSprintsApi = {
  list: (params?: AgileSprintListParams) =>
    rustFetch<AgileSprintListResponse>(
      `/v1/agile/sprints${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<AgileSprintDoc>(
      `/v1/agile/sprints/${encodeURIComponent(id)}`,
    ),
  create: (input: AgileSprintCreateInput) =>
    rustFetch<{ id: string; entity: AgileSprintDoc }>(
      '/v1/agile/sprints',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: AgileSprintUpdateInput) =>
    rustFetch<AgileSprintDoc>(
      `/v1/agile/sprints/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/agile/sprints/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
