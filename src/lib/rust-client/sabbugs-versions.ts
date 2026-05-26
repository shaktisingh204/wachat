import 'server-only';

/**
 * SabBugs — Versions rust-client. Wraps `/v1/sabbugs/versions`.
 */
import { rustFetch } from './fetcher';

export type BugVersionStatus = 'planned' | 'released' | 'archived';

export interface BugVersionDoc {
  _id: string;
  userId?: string;
  projectId?: string;
  name: string;
  notes?: string;
  releasedAt?: string;
  status: BugVersionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BugVersionListParams {
  page?: number;
  limit?: number;
  q?: string;
  projectId?: string;
  status?: BugVersionStatus | 'all';
}

export interface BugVersionListResponse {
  items: BugVersionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BugVersionCreateInput {
  name: string;
  projectId?: string;
  notes?: string;
  releasedAt?: string;
  status?: BugVersionStatus;
}

export type BugVersionUpdateInput = Partial<BugVersionCreateInput>;

function buildListQuery(p?: BugVersionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.projectId) qs.set('projectId', p.projectId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbugsVersionsApi = {
  list: (params?: BugVersionListParams) =>
    rustFetch<BugVersionListResponse>(
      `/v1/sabbugs/versions${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<BugVersionDoc>(
      `/v1/sabbugs/versions/${encodeURIComponent(id)}`,
    ),
  create: (input: BugVersionCreateInput) =>
    rustFetch<{ id: string; entity: BugVersionDoc }>(
      `/v1/sabbugs/versions`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: BugVersionUpdateInput) =>
    rustFetch<BugVersionDoc>(
      `/v1/sabbugs/versions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbugs/versions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
