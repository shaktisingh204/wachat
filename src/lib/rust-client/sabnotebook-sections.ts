import 'server-only';

/**
 * SabNotebook Sections client — wraps `/v1/sabnotebook/sections`.
 */
import { rustFetch } from './fetcher';

export interface SabnotebookSection {
  _id: string;
  userId?: string;
  notebookId: string;
  name: string;
  order?: number;
  color?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabnotebookSectionListParams {
  notebookId?: string;
  page?: number;
  limit?: number;
  q?: string;
  status?: 'active' | 'archived' | 'all';
}

export interface SabnotebookSectionListResponse {
  items: SabnotebookSection[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabnotebookSectionCreateInput {
  notebookId: string;
  name: string;
  order?: number;
  color?: string;
}

export type SabnotebookSectionUpdateInput = Partial<
  Omit<SabnotebookSectionCreateInput, 'notebookId'>
> & {
  archived?: boolean;
};

function buildListQuery(p?: SabnotebookSectionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.notebookId) qs.set('notebookId', p.notebookId);
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabnotebookSectionsApi = {
  list: (params?: SabnotebookSectionListParams) =>
    rustFetch<SabnotebookSectionListResponse>(
      `/v1/sabnotebook/sections${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabnotebookSection>(
      `/v1/sabnotebook/sections/${encodeURIComponent(id)}`,
    ),
  create: (input: SabnotebookSectionCreateInput) =>
    rustFetch<{ id: string; entity: SabnotebookSection }>(
      '/v1/sabnotebook/sections',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabnotebookSectionUpdateInput) =>
    rustFetch<SabnotebookSection>(
      `/v1/sabnotebook/sections/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabnotebook/sections/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
