import 'server-only';

/**
 * SabWriter comments client — wraps `/v1/sabwriter/comments`.
 *
 * Comments anchor to a ProseMirror `{from, to}` range and thread via
 * `parentCommentId`.
 */
import { rustFetch } from './fetcher';

export interface SabwriterCommentAnchor {
  from: number;
  to: number;
}

export interface SabwriterCommentDoc {
  _id: string;
  userId?: string;
  documentId: string;
  anchor: SabwriterCommentAnchor;
  authorUserId: string;
  body: string;
  resolved?: boolean;
  parentCommentId?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CommentListParams {
  documentId: string;
  status?: 'open' | 'resolved' | 'all';
  page?: number;
  limit?: number;
}

export interface CommentListResponse {
  items: SabwriterCommentDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateCommentInput {
  documentId: string;
  anchor: SabwriterCommentAnchor;
  body: string;
  parentCommentId?: string;
}

export interface UpdateCommentInput {
  body?: string;
  resolved?: boolean;
}

function qs(p: CommentListParams): string {
  const u = new URLSearchParams();
  u.set('documentId', p.documentId);
  if (p.status) u.set('status', p.status);
  if (p.page != null) u.set('page', String(p.page));
  if (p.limit != null) u.set('limit', String(p.limit));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const sabwriterCommentsApi = {
  list: (p: CommentListParams) =>
    rustFetch<CommentListResponse>(`/v1/sabwriter/comments${qs(p)}`),
  getById: (id: string) =>
    rustFetch<SabwriterCommentDoc>(
      `/v1/sabwriter/comments/${encodeURIComponent(id)}`,
    ),
  create: (input: CreateCommentInput) =>
    rustFetch<{ id: string; entity: SabwriterCommentDoc }>(
      '/v1/sabwriter/comments',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: UpdateCommentInput) =>
    rustFetch<SabwriterCommentDoc>(
      `/v1/sabwriter/comments/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  resolve: (id: string) =>
    rustFetch<SabwriterCommentDoc>(
      `/v1/sabwriter/comments/${encodeURIComponent(id)}/resolve`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabwriter/comments/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
