import 'server-only';

/**
 * Agile Velocity client — wraps `/v1/agile/velocity`.
 */
import { rustFetch } from './fetcher';

export interface AgileVelocityDoc {
  _id: string;
  userId?: string;
  projectId: string;
  sprintId: string;
  sprintName: string;
  plannedPoints: number;
  completedPoints: number;
  completedAt: string;
  createdAt: string;
}

export interface AgileVelocityListParams {
  projectId?: string;
  /** Defaults to 10, max 50. Returned oldest-first for chart rendering. */
  limit?: number;
}

export interface AgileVelocityListResponse {
  items: AgileVelocityDoc[];
}

export interface AgileVelocityRecordInput {
  projectId: string;
  sprintId: string;
  sprintName: string;
  plannedPoints: number;
  completedPoints: number;
  completedAt?: string;
}

function buildListQuery(p?: AgileVelocityListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.projectId) qs.set('projectId', p.projectId);
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const agileVelocityApi = {
  list: (params?: AgileVelocityListParams) =>
    rustFetch<AgileVelocityListResponse>(
      `/v1/agile/velocity${buildListQuery(params)}`,
    ),
  record: (input: AgileVelocityRecordInput) =>
    rustFetch<{ id: string; entity: AgileVelocityDoc }>('/v1/agile/velocity', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
