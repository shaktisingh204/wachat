import 'server-only';

/**
 * SabBugs — Saved Filters rust-client. Wraps
 * `/v1/sabbugs/saved-filters`.
 */
import { rustFetch } from './fetcher';

export interface BugSavedFilterDoc {
  _id: string;
  userId?: string;
  ownerId: string;
  name: string;
  queryJson: Record<string, unknown>;
  isShared?: boolean;
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface BugSavedFilterListParams {
  page?: number;
  limit?: number;
  q?: string;
  mineOnly?: boolean;
}

export interface BugSavedFilterListResponse {
  items: BugSavedFilterDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BugSavedFilterCreateInput {
  name: string;
  queryJson: Record<string, unknown>;
  isShared?: boolean;
}

export type BugSavedFilterUpdateInput = Partial<BugSavedFilterCreateInput>;

function buildListQuery(p?: BugSavedFilterListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.mineOnly) qs.set('mineOnly', 'true');
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbugsSavedFiltersApi = {
  list: (params?: BugSavedFilterListParams) =>
    rustFetch<BugSavedFilterListResponse>(
      `/v1/sabbugs/saved-filters${buildListQuery(params)}`,
    ),
  create: (input: BugSavedFilterCreateInput) =>
    rustFetch<{ id: string; entity: BugSavedFilterDoc }>(
      `/v1/sabbugs/saved-filters`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: BugSavedFilterUpdateInput) =>
    rustFetch<BugSavedFilterDoc>(
      `/v1/sabbugs/saved-filters/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbugs/saved-filters/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
