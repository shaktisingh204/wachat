import 'server-only';

/**
 * Agile Epics client — wraps `/v1/agile/epics`.
 */
import { rustFetch } from './fetcher';

export type AgileEpicStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'archived';

export interface AgileEpicDoc {
  _id: string;
  userId?: string;
  projectId: string;
  name: string;
  description?: string;
  color?: string;
  startDate?: string;
  endDate?: string;
  status: AgileEpicStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgileEpicListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: AgileEpicStatus | 'all';
  projectId?: string;
}

export interface AgileEpicListResponse {
  items: AgileEpicDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AgileEpicCreateInput {
  projectId: string;
  name: string;
  description?: string;
  color?: string;
  startDate?: string;
  endDate?: string;
  status?: AgileEpicStatus;
}

export type AgileEpicUpdateInput = Partial<Omit<AgileEpicCreateInput, 'projectId'>>;

function buildListQuery(p?: AgileEpicListParams): string {
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

export const agileEpicsApi = {
  list: (params?: AgileEpicListParams) =>
    rustFetch<AgileEpicListResponse>(
      `/v1/agile/epics${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<AgileEpicDoc>(`/v1/agile/epics/${encodeURIComponent(id)}`),
  create: (input: AgileEpicCreateInput) =>
    rustFetch<{ id: string; entity: AgileEpicDoc }>('/v1/agile/epics', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: AgileEpicUpdateInput) =>
    rustFetch<AgileEpicDoc>(`/v1/agile/epics/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/agile/epics/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
