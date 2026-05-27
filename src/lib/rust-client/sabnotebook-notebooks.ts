import 'server-only';

/**
 * SabNotebook Notebooks client — wraps `/v1/sabnotebook/notebooks`.
 */
import { rustFetch } from './fetcher';

export interface SabnotebookNotebook {
  _id: string;
  userId?: string;
  name: string;
  color?: string;
  coverFileId?: string;
  parentId?: string;
  description?: string;
  archived?: boolean;
  noteCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabnotebookNotebookListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  parentId?: string;
}

export interface SabnotebookNotebookListResponse {
  items: SabnotebookNotebook[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabnotebookNotebookCreateInput {
  name: string;
  color?: string;
  coverFileId?: string;
  parentId?: string;
  description?: string;
  archived?: boolean;
}

export type SabnotebookNotebookUpdateInput = Partial<SabnotebookNotebookCreateInput> & {
  noteCount?: number;
};

function buildListQuery(p?: SabnotebookNotebookListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.parentId) qs.set('parentId', p.parentId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabnotebookNotebooksApi = {
  list: (params?: SabnotebookNotebookListParams) =>
    rustFetch<SabnotebookNotebookListResponse>(
      `/v1/sabnotebook/notebooks${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabnotebookNotebook>(
      `/v1/sabnotebook/notebooks/${encodeURIComponent(id)}`,
    ),
  create: (input: SabnotebookNotebookCreateInput) =>
    rustFetch<{ id: string; entity: SabnotebookNotebook }>(
      '/v1/sabnotebook/notebooks',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabnotebookNotebookUpdateInput) =>
    rustFetch<SabnotebookNotebook>(
      `/v1/sabnotebook/notebooks/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabnotebook/notebooks/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
