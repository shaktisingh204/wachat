import 'server-only';

/**
 * SabNotebook Attachments client — wraps `/v1/sabnotebook/attachments`.
 *
 * Every attachment row is a SabFiles file id; never a raw URL.
 */
import { rustFetch } from './fetcher';

export type SabnotebookAttachmentKind = 'image' | 'audio' | 'video' | 'file';

export interface SabnotebookAttachment {
  _id: string;
  userId?: string;
  noteId: string;
  fileId: string;
  kind: SabnotebookAttachmentKind | string;
  name?: string;
  mime?: string;
  size?: number;
  order?: number;
  createdAt?: string;
}

export interface SabnotebookAttachmentListParams {
  noteId?: string;
  kind?: SabnotebookAttachmentKind | string;
  limit?: number;
}

export interface SabnotebookAttachmentListResponse {
  items: SabnotebookAttachment[];
  limit: number;
  hasMore: boolean;
}

export interface SabnotebookAttachmentCreateInput {
  noteId: string;
  fileId: string;
  kind: SabnotebookAttachmentKind;
  name?: string;
  mime?: string;
  size?: number;
  order?: number;
}

function buildListQuery(p?: SabnotebookAttachmentListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.noteId) qs.set('noteId', p.noteId);
  if (p.kind) qs.set('kind', p.kind);
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabnotebookAttachmentsApi = {
  list: (params?: SabnotebookAttachmentListParams) =>
    rustFetch<SabnotebookAttachmentListResponse>(
      `/v1/sabnotebook/attachments${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabnotebookAttachment>(
      `/v1/sabnotebook/attachments/${encodeURIComponent(id)}`,
    ),
  create: (input: SabnotebookAttachmentCreateInput) =>
    rustFetch<{ id: string; entity: SabnotebookAttachment }>(
      '/v1/sabnotebook/attachments',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabnotebook/attachments/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
