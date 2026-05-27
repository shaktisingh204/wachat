import 'server-only';

/**
 * SabNotebook Notes client — wraps `/v1/sabnotebook/notes`.
 */
import { rustFetch } from './fetcher';

export type SabnotebookNoteKind =
  | 'text'
  | 'checklist'
  | 'audio'
  | 'sketch'
  | 'file';

export interface SabnotebookNote {
  _id: string;
  userId?: string;
  sectionId: string;
  notebookId?: string;
  title?: string;
  kind: SabnotebookNoteKind | string;
  blocksJson?: string;
  preview?: string;
  color?: string;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
  trashed?: boolean;
  remindAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabnotebookNoteListParams {
  page?: number;
  limit?: number;
  q?: string;
  sectionId?: string;
  notebookId?: string;
  kind?: SabnotebookNoteKind | string;
  tag?: string;
  pinned?: boolean;
  status?: 'active' | 'archived' | 'trashed' | 'all';
}

export interface SabnotebookNoteListResponse {
  items: SabnotebookNote[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabnotebookNoteCreateInput {
  sectionId: string;
  notebookId?: string;
  title?: string;
  kind?: SabnotebookNoteKind | string;
  blocksJson?: string;
  preview?: string;
  color?: string;
  tags?: string[];
  pinned?: boolean;
  remindAt?: string;
}

export type SabnotebookNoteUpdateInput = Partial<SabnotebookNoteCreateInput> & {
  archived?: boolean;
  trashed?: boolean;
};

export interface SabnotebookNoteSearchParams {
  q: string;
  notebookId?: string;
  tag?: string;
  limit?: number;
}

function buildListQuery(p?: SabnotebookNoteListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.sectionId) qs.set('sectionId', p.sectionId);
  if (p.notebookId) qs.set('notebookId', p.notebookId);
  if (p.kind) qs.set('kind', p.kind);
  if (p.tag) qs.set('tag', p.tag);
  if (p.pinned != null) qs.set('pinned', String(p.pinned));
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

function buildSearchQuery(p: SabnotebookNoteSearchParams): string {
  const qs = new URLSearchParams();
  qs.set('q', p.q);
  if (p.notebookId) qs.set('notebookId', p.notebookId);
  if (p.tag) qs.set('tag', p.tag);
  if (p.limit != null) qs.set('limit', String(p.limit));
  return `?${qs.toString()}`;
}

export const sabnotebookNotesApi = {
  list: (params?: SabnotebookNoteListParams) =>
    rustFetch<SabnotebookNoteListResponse>(
      `/v1/sabnotebook/notes${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabnotebookNote>(
      `/v1/sabnotebook/notes/${encodeURIComponent(id)}`,
    ),
  create: (input: SabnotebookNoteCreateInput) =>
    rustFetch<{ id: string; entity: SabnotebookNote }>(
      '/v1/sabnotebook/notes',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabnotebookNoteUpdateInput) =>
    rustFetch<SabnotebookNote>(
      `/v1/sabnotebook/notes/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabnotebook/notes/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  pin: (id: string, pinned: boolean) =>
    rustFetch<SabnotebookNote>(
      `/v1/sabnotebook/notes/${encodeURIComponent(id)}/pin`,
      { method: 'POST', body: JSON.stringify({ pinned }) },
    ),
  archive: (id: string, archived: boolean) =>
    rustFetch<SabnotebookNote>(
      `/v1/sabnotebook/notes/${encodeURIComponent(id)}/archive`,
      { method: 'POST', body: JSON.stringify({ archived }) },
    ),
  search: (params: SabnotebookNoteSearchParams) =>
    rustFetch<SabnotebookNoteListResponse>(
      `/v1/sabnotebook/notes/search${buildSearchQuery(params)}`,
    ),
};
